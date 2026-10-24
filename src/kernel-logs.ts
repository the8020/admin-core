import { context } from "@the8020/context";
import {
  formatLogRecord,
  kernel,
  type LogPage,
  type LogQuery,
} from "@the8020/kernel";
import {
  BACK_EVENT,
  callScreen,
  copyText,
  download,
  field,
  Model,
  nextScreenChannel,
  z,
} from "/p/the8020/uui/mod.ts";
import { runtimeInfo, sandboxId, workerId } from "../types/runtime.ts";
import { allowed } from "./authorized.ts";

const VIEW = "the8020.admin-core.logs.view";
const Filters = z.object({
  node_id: field(runtimeInfo.shape.nodeId, { label: "Node" }),
  text: field(z.string().max(1024), {
    label: "Search text",
    length: "long",
    description:
      "Case-sensitive literal text in messages and attributes, at most 1024 UTF-8 bytes.",
  }),
  level: field(z.enum(["", "debug", "info", "warn", "error"]), {
    label: "Minimum level",
    description:
      "Includes this severity and higher; blank includes every level.",
  }),
  source: field(z.enum(["", "kernel", "deno", "logd"]), {
    label: "Source",
    description: "Kernel, Deno or the log writer; blank includes every source.",
  }),
  from: field(z.string(), {
    label: "From (RFC3339)",
    description: "Inclusive capture time, for example 2026-10-24T08:00:00Z.",
  }),
  until: field(z.string(), {
    label: "Until (RFC3339)",
    description: "Exclusive capture time in RFC3339 format.",
  }),
  sandbox_id: field(sandboxId, { valueHelp: undefined }),
  worker_id: workerId,
  context_id: field(z.string(), {
    label: "Context ID",
    description: "Exact execution context, ctx-*.",
  }),
  object: field(z.string(), {
    label: "Declared object",
    description: "Exact object, for example service:the8020/uui/session.",
  }),
  username: field(z.string(), {
    label: "Execution user",
    description: "Exact username attached to the execution.",
  }),
});
const Logs = Filters.extend({
  status: field(z.string(), {
    label: "Page status",
    description:
      "Owning node, page size, continuation, retention and availability.",
    readOnly: true,
    length: "long",
  }),
  output: field(z.string(), {
    label: "Displayed page",
    description:
      "Only this bounded page is copied or saved. First searches retained history; Recent searches a bounded recent window.",
    control: "textarea",
    readOnly: true,
    rowSpan: 8,
    length: "long",
    style: "font-family: monospace;",
  }),
});

export function pageText(page: LogPage): string {
  return page.records.map(formatLogRecord).join("\n");
}

export function pageStatus(page: LogPage): string {
  if (page.state !== "ok") {
    return `${page.state}: ${
      page.reason ?? "Logs cannot be read; try First or Recent."
    }`;
  }
  return [
    `${page.records.length} records`,
    page.more ? "More available" : "End of current results",
    page.tail_limited ? "Recent window only; use First for older logs" : "",
    page.corrupt_records
      ? `${page.corrupt_records} unreadable records skipped`
      : "",
  ].filter(Boolean).join(" · ");
}

export async function kernelLogs(): Promise<void> {
  const initial = {
    node_id: context.nodeId,
    text: "",
    level: "" as const,
    source: "" as const,
    from: "",
    until: "",
    sandbox_id: "",
    worker_id: "",
    context_id: "",
    object: "",
    username: "",
  };
  if (!await allowed(VIEW, initial.node_id)) return;
  const model = new Model<z.infer<typeof Logs>>({
    ...initial,
    output: "",
    status: "",
  });
  let filters = "";
  let query: LogQuery = {};
  let page: LogPage | undefined;
  let status = "";
  let action = "recent";
  while (true) {
    const values = Filters.parse(model.data);
    values.node_id = values.node_id.trim() || context.nodeId;
    model.data.node_id = values.node_id;
    if (!await allowed(VIEW, values.node_id)) return;
    const changed = filters !== JSON.stringify(values);
    if (
      changed ||
      ["first", "recent", "next", "refresh", "search"].includes(action)
    ) {
      if (
        changed || action === "search" || action === "first" ||
        action === "recent"
      ) {
        query = Object.fromEntries(
          Object.entries(values).filter(([, v]) => v !== ""),
        ) as LogQuery;
        query.limit = 100;
        if (action === "recent") query.tail = true;
      } else if (action === "next" && page?.cursor) {
        query = { ...query, cursor: page.cursor, tail: undefined };
      }
      filters = JSON.stringify(values);
      try {
        page = await kernel.logs.query(query);
        model.data.output = pageText(page);
        status = pageStatus(page);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw error;
        page = undefined;
        model.data.output = "";
        status = error instanceof Error ? error.message : String(error);
      }
    }
    if (action === "copy") copyText(model.data.output);
    model.data.status = `Node ${values.node_id} · ${status}`;
    const channel = nextScreenChannel();
    const pending = callScreen({
      id: "kernel-logs",
      title: "Kernel logs",
      schema: Logs,
      model,
      layout: {
        schema: 1,
        id: "kernel-logs",
        root: {
          id: "logs",
          type: "stack",
          children: [
            {
              id: "filters",
              type: "field-group",
              title: "Filters",
              controls: Object.keys(Filters.shape),
            },
            { id: "page", type: "detail", controls: ["status", "output"] },
          ],
        },
      },
      header: {
        actions: [
          { id: "search", label: "Search", kind: "primary" },
          { id: "first", label: "First" },
          { id: "recent", label: "Recent" },
          ...(page?.cursor && page.state === "ok"
            ? [{ id: "next", label: "Next" }]
            : []),
          { id: "refresh", label: "Refresh" },
          { id: "copy", label: "Copy page" },
          { id: "save", label: "Save page" },
        ],
      },
    });
    if (action === "save") {
      download({
        filename: "kernel-log-page.txt",
        contentType: "text/plain;charset=utf-8",
        body: new Blob([model.data.output]).stream(),
      }, channel.downloads);
    }
    const event = await pending;
    if (event.action === BACK_EVENT) return;
    action = event.action;
    if (!await allowed(VIEW, values.node_id)) return;
  }
}
