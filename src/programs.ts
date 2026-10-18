import { programInfo } from "/p/the8020/packages/types/program.ts";
import { sourceInfo } from "/p/the8020/packages/types/source.ts";
import {
  listPrograms,
  type ProgramSummary,
} from "/p/the8020/packages/programs.ts";
import {
  BACK_EVENT,
  callScreen,
  field,
  Model,
  presentPage,
  sendMessage,
  z,
} from "/p/the8020/uui/mod.ts";
import type { ScreenResult } from "./navigation.ts";
import { ScreenFrame } from "./screen_frame.ts";
import listLayout from "./layouts/program-list.json" with { type: "json" };
import detailLayout from "./layouts/program-detail.json" with { type: "json" };
import { programId as programField } from "/p/the8020/packages/types/program.ts";
import { packageId as packageField } from "/p/the8020/packages/types/package.ts";
import { kernel } from "@the8020/kernel";
import { runtimeInfo, sandboxId, workerId } from "../types/runtime.ts";
import type { SandboxInspectResult, WorkerListResult } from "./contracts.ts";
import { resourceModel, sumWorkerResources } from "./resources.ts";

const Program = z.object({
  id: field(programField, {
    label: "Program ID",
    length: "long",
    readOnly: true,
  }),
  packageId: field(packageField, {
    label: "Package",
    length: "long",
    readOnly: true,
  }),
  name: field(programInfo.shape.name, { readOnly: true }),
  kind: field(programInfo.shape.kind, { readOnly: true, length: "short" }),
  description: field(programInfo.shape.description, {
    length: "long",
    readOnly: true,
  }),
  uui: field(programInfo.shape.uui, { readOnly: true }),
  discoverable: field(programInfo.shape.discoverable, { readOnly: true }),
  entrypoint: field(sourceInfo.shape.entrypoint, {
    length: "long",
    readOnly: true,
  }),
  metadataError: field(programInfo.shape.metadataError, {
    readOnly: true,
    length: "long",
  }),
  commit: field(sourceInfo.shape.commit, {
    label: "Package commit",
    length: "long",
    readOnly: true,
  }),
});
const ProgramList = z.object({ programs: z.array(Program) });
const ProgramDetail = Program.extend({
  workerCount: field(runtimeInfo.shape.workerCount, { readOnly: true }),
  heap: field(runtimeInfo.shape.heap, { readOnly: true }),
  cpu: field(runtimeInfo.shape.cpu, { readOnly: true }),
  resourceSampledAt: field(runtimeInfo.shape.resourceSampledAt, {
    readOnly: true,
  }),
  runningWorkers: z.array(z.object({
    workerId,
    sandboxId,
    state: runtimeInfo.shape.workerState,
    heap: runtimeInfo.shape.heap,
    cpu: runtimeInfo.shape.cpu,
  })),
});

function programModel(program: ProgramSummary): z.infer<typeof Program> {
  return {
    id: program.program_id,
    packageId: program.package_id,
    name: program.name,
    kind: program.metadata_error
      ? "Unavailable"
      : program.uui
      ? "Interactive"
      : "Background job",
    description: program.description || program.name,
    uui: program.uui,
    discoverable: program.discoverable,
    entrypoint: program.entrypoint,
    commit: program.commit,
    metadataError: program.metadata_error ?? "",
  };
}

export async function programList(
  frame = new ScreenFrame(),
): Promise<ScreenResult> {
  while (true) {
    const programs = await listPrograms();
    const event = await callScreen({
      id: "core-admin-programs",
      title: "Programs",
      schema: ProgramList,
      model: frame.model({ programs: programs.map(programModel) }),
      layout: listLayout,
    });
    if (event.action === BACK_EVENT) return { view: "back" };
    if (
      event.action === "select" && typeof event.value === "string" &&
      programs.some((program) => program.program_id === event.value)
    ) {
      return { view: "program", programId: event.value };
    }
  }
}

export async function programDetail(
  programId: string,
  frame = new ScreenFrame(),
): Promise<ScreenResult> {
  while (true) {
    const program = (await listPrograms()).find((item) =>
      item.program_id === programId
    );
    if (!program) {
      sendMessage("This program is no longer available.", "error");
      return { view: "back" };
    }
    const listed = await kernel.admin.execute<WorkerListResult>("worker.list");
    const running = (listed.workers ?? []).filter((worker) =>
      worker.workload_type === "job" && worker.workload_id === programId
    );
    const refreshed = [];
    for (
      const sandboxId of new Set(running.map((worker) => worker.sandbox_id))
    ) {
      const { sandbox } = await kernel.admin.execute<SandboxInspectResult>(
        "sandbox.refresh",
        { sandbox_id: sandboxId },
      );
      refreshed.push(
        ...(sandbox.workers ?? []).filter((worker) =>
          worker.workload_id === programId
        ).map((worker) => ({ ...worker, sandbox_id: sandboxId })),
      );
    }
    const model = {
      ...programModel(program),
      ...resourceModel(sumWorkerResources(refreshed)),
      workerCount: refreshed.length,
      runningWorkers: refreshed.map((worker) => ({
        workerId: worker.worker_id,
        sandboxId: worker.sandbox_id,
        state: worker.state,
        ...resourceModel(worker.resources),
      })),
    };
    const event = await callScreen({
      id: "core-admin-program",
      title: `Program ${program.name}`,
      schema: ProgramDetail,
      model: frame.model(model),
      layout: detailLayout,
      controls: [
        "description",
        "kind",
        "packageId",
        "workerCount",
        "heap",
        "cpu",
      ].map((bind) => ({ bind })),
      actions: [{ id: "package", label: "Open package" }],
      header: {
        actions: [
          { id: "execute", label: "Execute", kind: "primary" },
          { id: "advanced", label: "Advanced" },
          { id: "refresh", label: "[[icon=refresh]] Refresh" },
        ],
      },
    });
    if (event.action === BACK_EVENT) return { view: "back" };
    if (event.action === "package") {
      return { view: "package", packageId: program.package_id };
    }
    if (event.action === "select" && typeof event.value === "string") {
      return { view: "worker", workerId: event.value };
    }
    if (event.action === "advanced") {
      await presentPage(() =>
        callScreen({
          id: "core-admin-program-advanced",
          title: `Advanced · ${program.name}`,
          schema: Program,
          model: new Model(programModel(program)),
          controls: [
            "id",
            "entrypoint",
            "commit",
            "uui",
            "discoverable",
            ...(program.metadata_error ? ["metadataError"] : []),
          ].map((
            bind,
          ) => ({ bind })),
        })
      );
    }
    if (event.action === "execute") {
      const { default: execute } = await import(
        "/p/the8020/jobs/programs/run-program/program.ts"
      );
      await execute(programId);
    }
  }
}
