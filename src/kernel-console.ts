import { text as localizedText } from "/p/the8020/i18n/mod.ts";
import { msg } from "/p/the8020/admin-core/i18n/messages.ts";
import { type AdminCatalog, kernel } from "@the8020/kernel";
import { context } from "@the8020/context";
import {
  BACK_EVENT,
  callScreen,
  copyText,
  field,
  Model,
  presentModal,
  z,
} from "/p/the8020/uui/mod.ts";
import { allowed } from "./authorized.ts";

const EXECUTE = "the8020.admin-core.kernel.execute";
const Console = z.object({
  line: field(z.string().max(16384), {
    label: msg("kernel_console.kernel_call"),
    length: "long",
    description: msg(
      "kernel_console.native_command_syntax_including_quoted_arguments_choose",
    ),
  }),
  output: field(z.string(), {
    label: msg("kernel_console.result"),
    description: msg("kernel_console.latest_result_only_at_most_64_kib"),
    control: "textarea",
    readOnly: true,
    rowSpan: 8,
    length: "full",
    style: "font-family: monospace;",
  }),
});

export function commandRows(catalog: AdminCatalog) {
  return catalog.commands.map((command) => {
    const name = command.path?.join(" ") || command.name;
    return {
      name,
      summary: command.summary,
      syntax: command.usage ? `${name} ${command.usage}` : [
        name,
        ...(command.parameters ?? []).map((p) => {
          const argument = p.option
            ? `--${p.option}${p.type === "boolean" ? "" : ` <${p.type}>`}`
            : `<${p.name}>`;
          return p.required ? argument : `[${argument}]`;
        }),
      ].join(" "),
      parameters: (command.parameters ?? []).map((p) =>
        `${p.name}: ${p.description}`
      ).join("\n"),
      access: command.secrets?.length || command.parameters?.some((p) =>
          p.secret
        )
        ? localizedText(
          msg("kernel_console.secure_input_use_native_admin_or_dedicated"),
        )
        : command.mutates_state
        ? localizedText(msg("kernel_console.changes_state"))
        : localizedText(msg("kernel_console.read")),
    };
  });
}

export async function kernelConsole(): Promise<void> {
  if (!await allowed(EXECUTE, "")) return;
  const model = new Model({ line: "", output: "" });
  let status = `Node ${context.nodeId}`;
  while (true) {
    const event = await callScreen({
      id: "kernel-console",
      title: msg("kernel_console.kernel_calls"),
      description: status,
      schema: Console,
      model,
      controls: [{ bind: "line", enterEvent: "run" }, { bind: "output" }],
      header: {
        actions: [
          { id: "run", label: msg("kernel_console.run"), kind: "primary" },
          { id: "calls", label: msg("kernel_console.calls") },
          { id: "copy", label: msg("kernel_console.copy_result") },
          { id: "clear", label: msg("kernel_console.clear") },
        ],
      },
    });
    if (event.action === BACK_EVENT) return;
    if (!await allowed(EXECUTE, "")) return;
    try {
      if (event.action === "copy") copyText(model.data.output);
      if (event.action === "clear") model.data.output = "";
      if (event.action === "calls") {
        const catalog = await kernel.admin.catalog();
        const selected = await presentModal(() =>
          callScreen({
            id: "kernel-call-picker",
            title: msg("kernel_console.kernel_calls"),
            schema: z.object({
              calls: z.array(z.object({
                name: field(z.string(), {
                  label: msg("kernel_console.call"),
                  description: msg(
                    "kernel_console.canonical_command_name_from_the_running_kernel",
                  ),
                }),
                summary: field(z.string(), {
                  label: msg("kernel_console.description"),
                  description: msg("kernel_console.command_catalog_summary"),
                }),
                syntax: field(z.string(), {
                  label: msg("kernel_console.syntax"),
                  description: msg(
                    "kernel_console.required_arguments_and_optional_flags_from_the",
                  ),
                }),
                parameters: field(z.string(), {
                  label: msg("kernel_console.parameters"),
                  description: msg("kernel_console.native_parameter_meanings"),
                }),
                access: field(z.string(), {
                  label: msg("kernel_console.access"),
                  description: msg(
                    "kernel_console.whether_the_call_changes_state_or_needs",
                  ),
                }),
              })),
            }),
            model: new Model({ calls: commandRows(catalog) }),
            layout: {
              schema: 1,
              id: "calls",
              root: {
                id: "calls",
                type: "list",
                bind: "calls",
                key: "name",
                display: ["name", "summary", "syntax", "parameters", "access"],
                focusSearch: true,
              },
            },
          })
        );
        if (
          selected.action === "select" && typeof selected.value === "string"
        ) {
          model.data.line = selected.value + " ";
        }
      }
      if (event.action === "run") {
        const result = await kernel.admin.runLine(model.data.line);
        model.data.output = result.output;
        status = `Node ${context.nodeId} · ${
          result.exit_code === 0
            ? localizedText(msg("kernel_console.succeeded"))
            : localizedText(msg("kernel_console.failed"))
        }${result.truncated ? " · Truncated" : ""}`;
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      model.data.output = error instanceof Error
        ? error.message
        : String(error);
      status = `Node ${context.nodeId} · Failed`;
    }
  }
}
