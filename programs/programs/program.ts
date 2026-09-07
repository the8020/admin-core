import { runAdmin } from "../../src/navigation.ts";

export default function programs(programId?: string): Promise<void> {
  return runAdmin(
    programId === undefined
      ? { view: "programs" }
      : { view: "program", programId },
  );
}
