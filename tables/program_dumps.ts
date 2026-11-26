import { field, z } from "/p/the8020/db/fields.ts";
import { t, table, type TableDatabase } from "/p/the8020/db/mod.ts";
import { programId } from "/p/the8020/packages/types/program.ts";
import { shortDumpFields } from "/p/the8020/uui/src/short_dump.ts";
import { username } from "/p/the8020/users/types/user.ts";
import { msg } from "../i18n/messages.ts";

export const dumpFields = z.object({
  id: z.string(),
  username,
  programId,
  occurredAt: field(z.date(), { label: msg("program_dumps.time_utc") }),
  heading: field(z.string(), { label: msg("program_dumps.heading") }),
  dumpText: shortDumpFields.shape.dumpText,
});

const Dumps = table("the8020__admin_core__program_dumps", {
  id: t.from(dumpFields.shape.id).primaryKey(),
  username: t.from(dumpFields.shape.username),
  programId: t.from(dumpFields.shape.programId),
  occurredAt: t.from(dumpFields.shape.occurredAt),
  heading: t.from(dumpFields.shape.heading),
  dumpText: t.from(dumpFields.shape.dumpText),
}, {
  indexes: [
    { columns: ["occurredAt", "id"] },
    { columns: ["username", "occurredAt", "id"] },
    { columns: ["programId", "occurredAt", "id"] },
  ],
});

declare module "/p/the8020/db/types.ts" {
  interface Database extends TableDatabase<typeof Dumps> {}
}

export default Dumps;
