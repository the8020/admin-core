import { newId } from "@the8020/kernel";
import { transaction } from "/p/the8020/db/mod.ts";
import type { ShortDump } from "/p/the8020/uui/src/short_dump.ts";
import Dumps from "../tables/program_dumps.ts";

export async function recordProgramDump(
  username: string,
  heading: string,
  dump: ShortDump,
): Promise<void> {
  await transaction({ timeoutMs: 2_000 }, async (tx) => {
    await tx.insertInto(Dumps.table).values({
      id: newId("dmp"),
      username,
      programId: dump.programId,
      occurredAt: new Date(dump.occurredAt),
      heading: heading.slice(0, 1_024),
      dumpText: dump.dumpText,
    }).execute();
  });
}
