import { secretInfo } from "/p/the8020/secrets/types/secret.ts";
import { ScreenFrame } from "./screen_frame.ts";
import { kernel } from "@the8020/kernel";
import {
  BACK_EVENT,
  callScreen,
  field,
  sendMessage,
  z,
} from "/p/the8020/uui/mod.ts";
import secretEditLayout from "./layouts/secret-edit.json" with {
  type: "json",
};
import secretListLayout from "./layouts/secret-list.json" with {
  type: "json",
};
import type { ScreenResult } from "./navigation.ts";
import { secretName } from "/p/the8020/secrets/types/secret.ts";

const SecretRow = z.object({
  name: secretName,
  updatedAt: field(secretInfo.shape.updatedAt, { semanticType: "datetime" }),
});
const SecretList = z.object({ secrets: z.array(SecretRow) });

function secretEditSchema(existing: boolean) {
  return z.object({
    name: field(secretName, {
      label: "Name",
      length: "medium",
      readOnly: existing,
      placeholder: "github",
    }),
    value: field(secretInfo.shape.value, {
      label: existing ? "Replacement value" : "Value",
      description: existing
        ? "Paste the new credential. Saving **replaces** the current value."
        : "Paste the credential you want to save.",
      length: "long",
      control: "password",
    }),
  });
}

export async function secretList(
  frame = new ScreenFrame(),
): Promise<ScreenResult> {
  while (true) {
    const secrets = await kernel.secrets.list();
    const event = await callScreen({
      id: "core-admin-secrets",
      title: "Secrets",
      description: "Manage credentials used by your packages and services.",
      schema: SecretList,
      model: frame.model({
        secrets: secrets.map((secret) => ({
          name: secret.name,
          updatedAt: secret.updated_at,
        })),
      }),
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

export async function secretEdit(
  name?: string,
  frame = new ScreenFrame(),
): Promise<ScreenResult> {
  const existing = name !== undefined;
  const model = { name: name ?? "", value: "" };
  while (true) {
    const event = await callScreen({
      id: "core-admin-secret-edit",
      title: existing ? `Secret ${name}` : "Add secret",
      schema: secretEditSchema(existing),
      model: frame.model(model),
      layout: secretEditLayout,
      header: {
        actions: [{ id: "save", label: "Save secret", kind: "primary" }],
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
