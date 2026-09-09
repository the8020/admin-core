import { programInfo } from "/p/the8020/packages/types/program.ts";
import { sourceInfo } from "/p/the8020/packages/types/source.ts";
import { kernel, type ProgramSummary } from "@the8020/kernel";
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
  commit: field(sourceInfo.shape.commit, {
    label: "Package commit",
    length: "long",
    readOnly: true,
  }),
});
const ProgramList = z.object({ programs: z.array(Program) });

function programModel(program: ProgramSummary): z.infer<typeof Program> {
  return {
    id: program.program_id,
    packageId: program.package_id,
    name: program.name,
    kind: program.uui ? "Interactive" : "Background job",
    description: program.description || program.name,
    uui: program.uui,
    discoverable: program.discoverable,
    entrypoint: program.entrypoint,
    commit: program.commit,
  };
}

export async function programList(
  frame = new ScreenFrame(),
): Promise<ScreenResult> {
  while (true) {
    const programs = await kernel.programs.list();
    const event = await callScreen({
      id: "core-admin-programs",
      title: "Programs",
      schema: ProgramList,
      model: frame.model({ programs: programs.map(programModel) }),
      layout: listLayout,
      header: {
        actions: [{ id: "refresh", label: "[[icon=refresh]] Refresh" }],
      },
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
    const program = (await kernel.programs.list()).find((item) =>
      item.program_id === programId
    );
    if (!program) {
      sendMessage("This program is no longer available.", "error");
      return { view: "back" };
    }
    const event = await callScreen({
      id: "core-admin-program",
      title: `Program ${program.name}`,
      schema: Program,
      model: frame.model(programModel(program)),
      layout: detailLayout,
      controls: ["description", "kind", "packageId"].map((bind) => ({ bind })),
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
    if (event.action === "advanced") {
      await presentPage(() =>
        callScreen({
          id: "core-admin-program-advanced",
          title: `Advanced · ${program.name}`,
          schema: Program,
          model: new Model(programModel(program)),
          controls: ["id", "entrypoint", "commit", "uui", "discoverable"].map((
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
