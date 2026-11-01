import { text as localizedText } from "/p/the8020/i18n/mod.ts";
import { msg } from "/p/the8020/admin-core/i18n/messages.ts";
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
  node_id: field(runtimeInfo.shape.nodeId, { label: msg("kernel_logs.node") }),
  text: field(z.string().max(1024), {
    label: msg("kernel_logs.search_text"),
    length: "long",
    description: msg("kernel_logs.case_sensitive_literal_text_in_messages_and"),
  }),
  level: field(z.enum(["", "debug", "info", "warn", "error"]), {
    label: msg("kernel_logs.minimum_level"),
    description: msg(
      "kernel_logs.includes_this_severity_and_higher_blank_includes",
    ),
  }),
  source: field(z.enum(["", "kernel", "deno", "logd"]), {
    label: msg("kernel_logs.source"),
    description: msg("kernel_logs.kernel_deno_or_the_log_writer_blank"),
  }),
  from: field(z.string(), {
    label: msg("kernel_logs.from_rfc3339"),
    description: msg("kernel_logs.inclusive_capture_time_for_example_2026_10"),
  }),
  until: field(z.string(), {
    label: msg("kernel_logs.until_rfc3339"),
    description: msg("kernel_logs.exclusive_capture_time_in_rfc3339_format"),
  }),
  sandbox_id: field(sandboxId, { valueHelp: undefined }),
  worker_id: workerId,
  context_id: field(z.string(), {
    label: msg("kernel_logs.context_id"),
    description: msg("kernel_logs.exact_execution_context_ctx"),
  }),
  object: field(z.string(), {
    label: msg("kernel_logs.declared_object"),
    description: msg(
      "kernel_logs.exact_object_for_example_service_the8020_uui",
    ),
  }),
  username: field(z.string(), {
    label: msg("kernel_logs.execution_user"),
    description: msg("kernel_logs.exact_username_attached_to_the_execution"),
  }),
});
const Logs = Filters.extend({
  status: field(z.string(), {
    label: msg("kernel_logs.page_status"),
    description: msg(
      "kernel_logs.owning_node_page_size_continuation_retention_and",
    ),
    readOnly: true,
    length: "long",
  }),
  output: field(z.string(), {
    label: msg("kernel_logs.displayed_page"),
    description: msg("kernel_logs.only_this_bounded_page_is_copied_or"),
    control: "textarea",
    readOnly: true,
    rowSpan: 8,
    length: "full",
    style: "font-family: monospace;",
  }),
});

export function pageText(page: LogPage): string {
  return page.records.map(formatLogRecord).join("\n");
}

export function pageStatus(page: LogPage): string {
  if (page.state !== "ok") {
    return localizedText(
      msg("kernel_logs.value1_value2", {
        value1: page.state,
        value2: page.reason ??
          localizedText(msg("kernel_logs.logs_cannot_be_read_try_first_or")),
      }),
    );
  }
  return [
    `${page.records.length} records`,
    page.more
      ? localizedText(msg("kernel_logs.more_available"))
      : localizedText(msg("kernel_logs.end_of_current_results")),
    page.tail_limited
      ? localizedText(msg("kernel_logs.recent_window_only_use_first_for_older"))
      : "",
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
    if (["first", "recent", "next", "refresh", "search"].includes(action)) {
      const values = Filters.parse(model.data);
      values.node_id = values.node_id.trim() || context.nodeId;
      model.data.node_id = values.node_id;
      if (!await allowed(VIEW, values.node_id)) return;
      const changed = filters !== JSON.stringify(values);
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
    if (!await allowed(VIEW, query.node_id ?? context.nodeId)) return;
    if (action === "copy") copyText(model.data.output);
    model.data.status = `Node ${query.node_id} · ${status}`;
    const channel = nextScreenChannel();
    const pending = callScreen({
      id: "kernel-logs",
      title: msg("kernel_logs.kernel_logs"),
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
              title: msg("kernel_logs.filters"),
              controls: Object.keys(Filters.shape),
            },
            { id: "page", type: "detail", controls: ["status", "output"] },
          ],
        },
      },
      header: {
        actions: [
          { id: "search", label: msg("kernel_logs.search"), kind: "primary" },
          { id: "first", label: msg("kernel_logs.first") },
          { id: "recent", label: msg("kernel_logs.recent") },
          ...(page?.cursor && page.state === "ok"
            ? [{ id: "next", label: msg("kernel_logs.next") }]
            : []),
          { id: "refresh", label: msg("kernel_logs.refresh") },
          { id: "copy", label: msg("kernel_logs.copy_page") },
          { id: "save", label: msg("kernel_logs.save_page") },
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
  }
}
