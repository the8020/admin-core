import { kernel } from "@the8020/kernel";
import {
  BACK_EVENT,
  callScreen,
  field,
  Model,
  presentPage,
  z,
} from "/p/the8020/uui/mod.ts";
import { serviceId } from "/p/the8020/services/types/service.ts";
import { sandboxId, workerId } from "../types/runtime.ts";
import { ScreenFrame } from "./screen_frame.ts";
import type { ScreenResult } from "./navigation.ts";
import type { WorkerInspectResult, WorkerListResult } from "./contracts.ts";

const Worker = z.object({
  workerId: field(workerId, { readOnly: true, open: undefined }),
  sandboxId: field(sandboxId, { readOnly: true }),
  serviceId: field(serviceId, { readOnly: true }),
  owner: field(z.string(), { label: "Workload owner", readOnly: true }),
  state: field(z.string(), { label: "Status", readOnly: true }),
  requests: field(z.number().int(), {
    label: "Active requests",
    readOnly: true,
  }),
  executions: field(z.number().int(), {
    label: "Persistent executions",
    readOnly: true,
  }),
  failure: field(z.string(), { label: "Attention", readOnly: true }),
  workload: field(z.string(), { label: "Workload ID", readOnly: true }),
  entrypoint: field(z.string(), { label: "Entrypoint", readOnly: true }),
  release: field(z.string(), { label: "Release", readOnly: true }),
  debugger: field(z.string(), { label: "Debugger name", readOnly: true }),
});
const WorkerList = z.object({
  workers: z.array(
    Worker.pick({
      workerId: true,
      sandboxId: true,
      owner: true,
      state: true,
      requests: true,
    }),
  ),
});

export async function workerList(
  frame = new ScreenFrame(),
): Promise<ScreenResult> {
  while (true) {
    const result = await kernel.admin.execute<WorkerListResult>("worker.list");
    const event = await callScreen({
      id: "core-admin-workers",
      title: "Workers",
      schema: WorkerList,
      model: frame.model({
        workers: (result.workers ?? []).map((worker) => ({
          workerId: worker.worker_id,
          sandboxId: worker.sandbox_id,
          owner: worker.owner_id,
          state: worker.state,
          requests: worker.in_flight,
        })),
      }),
      layout: {
        schema: 1,
        id: "worker-list",
        root: {
          id: "workers",
          type: "list",
          bind: "workers",
          key: "workerId",
          display: ["workerId", "owner", "state", "requests", "sandboxId"],
        },
      },
      header: {
        actions: [{ id: "refresh", label: "[[icon=refresh]] Refresh" }],
      },
    });
    if (event.action === BACK_EVENT) return { view: "back" };
    if (event.action === "select" && typeof event.value === "string") {
      return { view: "worker", workerId: event.value };
    }
  }
}

export async function workerDetail(
  id: string,
  frame = new ScreenFrame(),
): Promise<ScreenResult> {
  while (true) {
    const { worker: record } = await kernel.admin.execute<WorkerInspectResult>(
      "worker.inspect",
      { worker_id: id },
    );
    const worker = record.worker;
    const service = record.workload_type === "service" ? worker.owner_id : "";
    const data = {
      workerId: worker.worker_id,
      sandboxId: record.sandbox_id,
      serviceId: service,
      owner: worker.owner_id,
      state: worker.state,
      requests: worker.in_flight,
      executions: worker.persistent_executions ?? 0,
      failure: worker.failure ?? "",
      workload: worker.workload_id ?? "",
      entrypoint: worker.entrypoint ?? "",
      release: worker.release_id ?? "",
      debugger: worker.debugger_name ?? "",
    };
    const controls = [
      "state",
      "requests",
      "executions",
      "sandboxId",
      service ? "serviceId" : "owner",
      ...(data.failure ? ["failure"] : []),
    ];
    const event = await callScreen({
      id: "core-admin-worker",
      title: `Worker ${id}`,
      schema: Worker,
      model: frame.model(data),
      controls: controls.map((bind) => ({ bind })),
      actions: [
        { id: "sandbox", label: "Open sandbox" },
        ...(service ? [{ id: "service", label: "Open service" }] : []),
      ],
      header: {
        actions: [{ id: "advanced", label: "Advanced" }, {
          id: "refresh",
          label: "[[icon=refresh]] Refresh",
        }],
      },
    });
    if (event.action === BACK_EVENT) return { view: "back" };
    if (event.action === "sandbox") {
      return { view: "sandbox", sandboxId: record.sandbox_id };
    }
    if (event.action === "service" && service) {
      return { view: "service", serviceId: service };
    }
    if (event.action === "advanced") {
      await presentPage(() =>
        callScreen({
          id: "core-admin-worker-advanced",
          title: `Advanced · ${id}`,
          schema: Worker,
          model: new Model(data),
          controls: [
            "workerId",
            "owner",
            "workload",
            "entrypoint",
            "release",
            "debugger",
          ].map((bind) => ({ bind })),
        })
      );
    }
  }
}
