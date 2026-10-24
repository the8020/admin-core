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
    label: "Kernel call",
    length: "long",
    description:
      "Native command syntax, including quoted arguments. Choose Calls for names, parameters and secure-input limitations.",
  }),
  output: field(z.string(), {
    label: "Result",
    description:
      "Latest result only, at most 64 KiB. Native errors retain their code. Select text or use Copy result.",
    control: "textarea",
    readOnly: true,
    rowSpan: 8,
    length: "long",
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
        ? "Secure input: use native admin or dedicated screen"
        : command.mutates_state
        ? "Changes state"
        : "Read",
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
      title: "Kernel calls",
      description: status,
      schema: Console,
      model,
      controls: [{ bind: "line", enterEvent: "run" }, { bind: "output" }],
      header: {
        actions: [
          { id: "run", label: "Run", kind: "primary" },
          { id: "calls", label: "Calls" },
          { id: "copy", label: "Copy result" },
          { id: "clear", label: "Clear" },
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
            title: "Kernel calls",
            schema: z.object({
              calls: z.array(z.object({
                name: field(z.string(), {
                  label: "Call",
                  description:
                    "Canonical command name from the running kernel.",
                }),
                summary: field(z.string(), {
                  label: "Description",
                  description: "Command catalog summary.",
                }),
                syntax: field(z.string(), {
                  label: "Syntax",
                  description:
                    "Required arguments and optional flags from the catalog.",
                }),
                parameters: field(z.string(), {
                  label: "Parameters",
                  description: "Native parameter meanings.",
                }),
                access: field(z.string(), {
                  label: "Access",
                  description:
                    "Whether the call changes state or needs a dedicated secure-input client.",
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
          result.exit_code === 0 ? "Succeeded" : "Failed"
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
