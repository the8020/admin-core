import { text as localizedText } from "/p/the8020/i18n/mod.ts";
import {
  BACK_EVENT,
  callScreen,
  copyText,
  field,
  Model,
  presentPage,
  z,
} from "/p/the8020/uui/mod.ts";
import { msg as uuiText } from "/p/the8020/uui/i18n/messages.ts";
import { msg } from "../i18n/messages.ts";
import Dumps, { dumpFields } from "../tables/program_dumps.ts";
import { allowed } from "./authorized.ts";

const VIEW = "the8020.admin-core.program-dumps.view";
const PAGE_SIZE = 100;
const isoDate = z.iso.date();
const date = z.string().refine(
  (value) => value === "" || isoDate.safeParse(value).success,
  { error: () => localizedText(msg("program_dumps.invalid_date")) },
);

const Filters = z.object({
  username: dumpFields.shape.username,
  programId: field(dumpFields.shape.programId, { length: "long" }),
  from: field(date, {
    label: msg("program_dumps.from_utc"),
    control: "date",
  }),
  through: field(date, {
    label: msg("program_dumps.through_utc"),
    control: "date",
  }),
});

const Summary = dumpFields.omit({ dumpText: true }).extend({
  occurredAt: field(z.string(), {
    label: msg("program_dumps.time_utc"),
  }),
});
const Results = z.object({ rows: Summary.array() });
const Detail = Summary.extend({
  dumpText: field(dumpFields.shape.dumpText, {
    control: "textarea",
    readOnly: true,
    length: "full",
    rowSpan: 8,
  }),
});

function day(value: string, offset = 0): Date {
  const result = new Date(value + "T00:00:00Z");
  result.setUTCDate(result.getUTCDate() + offset);
  return result;
}

type Cursor = { occurredAt: Date; id: string };

function readPage(filters: z.infer<typeof Filters>, after?: Cursor) {
  let query = Dumps.select([
    "id",
    "username",
    "programId",
    "heading",
    "occurredAt",
  ])
    .orderBy("occurredAt", "desc").orderBy("id", "desc").limit(PAGE_SIZE + 1);
  if (filters.username.trim()) {
    query = query.where("username", "=", filters.username.trim());
  }
  if (filters.programId.trim()) {
    query = query.where("programId", "=", filters.programId.trim());
  }
  if (filters.from) query = query.where("occurredAt", ">=", day(filters.from));
  if (filters.through) {
    query = query.where("occurredAt", "<", day(filters.through, 1));
  }
  if (after) {
    query = query.where((eb) =>
      eb.or([
        eb("occurredAt", "<", after.occurredAt),
        eb.and([
          eb("occurredAt", "=", after.occurredAt),
          eb("id", "<", after.id),
        ]),
      ])
    );
  }
  return query.execute();
}

export async function programDumps(): Promise<void> {
  if (!await allowed(VIEW, "")) return;
  const model = new Model({
    username: "",
    programId: "",
    from: "",
    through: "",
  });
  while (true) {
    const event = await callScreen({
      id: "program-dumps-selection",
      title: msg("program_dumps.title"),
      schema: Filters,
      model,
      controls: Object.keys(Filters.shape).map((bind) => ({ bind })),
      header: {
        actions: [
          { id: "search", label: msg("kernel_logs.search"), kind: "primary" },
          { id: "today", label: msg("program_dumps.today") },
          { id: "yesterday", label: msg("program_dumps.yesterday") },
        ],
      },
    });
    if (event.action === BACK_EVENT) return;
    if (event.action === "today" || event.action === "yesterday") {
      const today = new Date().toISOString().slice(0, 10);
      model.data.from = model.data.through = event.action === "today"
        ? today
        : day(today, -1).toISOString().slice(0, 10);
    }
    await presentPage(() => showResults({ ...model.data }));
  }
}

async function showResults(filters: z.infer<typeof Filters>): Promise<void> {
  const model = new Model<z.infer<typeof Results>>({ rows: [] });
  let after: Cursor | undefined;
  while (await allowed(VIEW, "")) {
    const page = await readPage(filters, after);
    const rows = page.slice(0, PAGE_SIZE);
    model.data.rows = rows.map((row) => ({
      ...row,
      occurredAt: row.occurredAt.toISOString(),
    }));
    const event = await callScreen({
      id: "program-dumps",
      title: msg("program_dumps.title"),
      schema: Results,
      model,
      layout: {
        schema: 1,
        id: "program-dumps",
        root: {
          id: "dumps",
          type: "list",
          bind: "rows",
          key: "id",
          display: ["username", "programId", "heading", "occurredAt"],
          toolbar: [
            { id: "refresh", label: msg("programs.refresh") },
            ...(after
              ? [{ id: "first", label: msg("kernel_logs.first") }]
              : []),
            ...(page.length > PAGE_SIZE
              ? [{ id: "next", label: msg("kernel_logs.next") }]
              : []),
          ],
        },
      },
    });
    if (event.action === BACK_EVENT) return;
    if (event.action === "first") after = undefined;
    if (event.action === "next" && page.length > PAGE_SIZE) {
      after = rows.at(-1);
    }
    if (event.action === "select" && typeof event.value === "string") {
      const id = event.value;
      if (rows.some((row) => row.id === id)) {
        await presentPage(() => showDetail(id));
      }
    }
  }
}

async function showDetail(id: string): Promise<void> {
  if (!await allowed(VIEW, "")) return;
  const row = await Dumps.selectAll().where("id", "=", id).executeTakeFirst();
  if (!row) return;
  const model = new Model({ ...row, occurredAt: row.occurredAt.toISOString() });
  while (true) {
    const event = await callScreen({
      id: "program-dump",
      title: uuiText("program.program_terminated"),
      schema: Detail,
      model,
      controls: ["username", "programId", "heading", "occurredAt", "dumpText"]
        .map((bind) => ({ bind, readOnly: true })),
      header: {
        actions: [{ id: "copy", label: uuiText("program.copy_short_dump") }],
      },
    });
    if (event.action === BACK_EVENT) return;
    if (event.action === "copy" && await allowed(VIEW, "")) {
      copyText(row.dumpText);
    }
  }
}
