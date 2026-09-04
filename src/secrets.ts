import { kernel } from "@the8020/kernel";
import {
  BACK_EVENT,
  callScreen,
  field,
  sendMessage,
  z,
} from "@packages/the8020/uui/mod.ts";
import secretEditLayout from "./layouts/secret-edit.json" with {
  type: "json",
};
import secretListLayout from "./layouts/secret-list.json" with {
  type: "json",
};
import type { ScreenResult } from "./navigation.ts";

const SecretRow = z.object({
  name: z.string(),
  updatedAt: z.string(),
});
const SecretList = z.object({ secrets: z.array(SecretRow) });

function secretEditSchema(existing: boolean) {
  return z.object({
    name: field(z.string(), {
      label: "Name",
      length: "long",
      readOnly: existing,
      placeholder: "github",
    }),
    value: field(z.string(), {
      label: existing ? "Replacement value" : "Value",
      description: existing
        ? "The stored value is never loaded or displayed. Saving replaces it."
        : "The value is sent directly to kernel secret storage and is not shown again.",
      length: "long",
      control: "password",
    }),
  });
}

export async function secretList(): Promise<ScreenResult> {
  while (true) {
    const secrets = await kernel.secrets.list();
    const event = await callScreen({
      id: "core-admin-secrets",
      title: "Secrets",
      description: "Stored values are intentionally omitted from this list.",
      schema: SecretList,
      model: {
        secrets: secrets.map((secret) => ({
          name: secret.name,
          updatedAt: secret.updated_at,
        })),
      },
      layout: secretListLayout,
      header: {
        actions: [
          { id: "add", label: "Add secret", kind: "primary" },
          { id: "refresh", label: "[[icon=refresh]] Refresh" },
        ],
      },
    });
    if (event.action === BACK_EVENT) return { view: "back" };
    if (event.action === "refresh") continue;
    if (event.action === "add") return { view: "secret", name: undefined };
    if (event.action === "select" && typeof event.value === "string") {
      return { view: "secret", name: event.value };
    }
  }
}

export async function secretEdit(name?: string): Promise<ScreenResult> {
  const existing = name !== undefined;
  const model = { name: name ?? "", value: "" };
  while (true) {
    const event = await callScreen({
      id: "core-admin-secret-edit",
      title: existing ? `Secret ${name}` : "Add secret",
      description: existing
        ? "Enter a replacement value. The current value is never read into this screen."
        : "Create a named value for kernel-owned authenticated operations.",
      schema: secretEditSchema(existing),
      model,
      layout: secretEditLayout,
      header: {
        actions: [{ id: "save", label: "Save", kind: "primary" }],
      },
    });
    if (event.action === BACK_EVENT) return { view: "back" };
    if (event.action !== "save") continue;
    try {
      const secretName = requiredName(model.name);
      await kernel.secrets.set({
        name: secretName,
        value: requiredValue(model.value),
      });
      model.value = "";
      sendMessage(
        existing ? `Updated ${secretName}` : `Created ${secretName}`,
        "success",
      );
      return { view: "back" };
    } catch (error) {
      model.value = "";
      sendMessage(
        error instanceof Error ? error.message : "Secret update failed",
        "error",
      );
    }
  }
}

function requiredName(value: string): string {
  const normalized = value.trim();
  if (normalized === "") throw new TypeError("Name is required");
  return normalized;
}

function requiredValue(value: string): string {
  if (value === "") throw new TypeError("Value is required");
  return value;
}
