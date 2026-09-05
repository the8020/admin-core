import { kernel, type ProgramSummary } from "@the8020/kernel";
import {
  BACK_EVENT,
  callScreen,
  field,
  sendMessage,
  z,
} from "/p/the8020/uui/mod.ts";
import type { ScreenResult } from "./navigation.ts";
import { ScreenFrame } from "./screen_frame.ts";
import listLayout from "./layouts/program-list.json" with { type: "json" };
import detailLayout from "./layouts/program-detail.json" with { type: "json" };

const Program = z.object({
  id: field(z.string(), {
    label: "Program ID",
    length: "long",
    readOnly: true,
  }),
  packageId: field(z.string(), {
    label: "Package",
    length: "long",
    readOnly: true,
  }),
  name: field(z.string(), { label: "Name", readOnly: true }),
  description: field(z.string(), {
    label: "Description",
    length: "long",
    readOnly: true,
  }),
  uui: field(z.boolean(), { label: "UUI", readOnly: true }),
  discoverable: field(z.boolean(), { label: "Discoverable", readOnly: true }),
  entrypoint: field(z.string(), {
    label: "Entrypoint",
    length: "long",
    readOnly: true,
  }),
  commit: field(z.string(), {
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
    description: program.description ?? "",
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
      title: `Program ${programId}`,
      schema: Program,
      model: frame.model(programModel(program)),
      layout: detailLayout,
      header: {
        actions: [
          { id: "execute", label: "Execute", kind: "primary" },
          { id: "refresh", label: "[[icon=refresh]] Refresh" },
        ],
      },
    });
    if (event.action === BACK_EVENT) return { view: "back" };
    if (event.action === "execute") {
      const { default: execute } = await import(
        "/p/the8020/jobs/programs/run-program/program.ts"
      );
      await execute(programId);
    }
  }
}
