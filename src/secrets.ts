import { text as localizedText } from "/p/the8020/i18n/mod.ts";
import { msg } from "/p/the8020/admin-core/i18n/messages.ts";
import { secrets as secretStore } from "/p/the8020/secrets/src/admin.ts";
import { secretInfo } from "/p/the8020/secrets/types/secret.ts";
import { ScreenFrame } from "./screen_frame.ts";
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
      label: msg("secrets.name"),
      length: "medium",
      readOnly: existing,
      placeholder: msg("secrets.github"),
    }),
    value: field(secretInfo.shape.value, {
      label: existing
        ? localizedText(msg("secrets.replacement_value"))
        : localizedText(msg("secrets.value")),
      description: existing
        ? localizedText(
          msg("secrets.paste_the_new_credential_saving_replaces_the"),
        )
        : localizedText(msg("secrets.paste_the_credential_you_want_to_save")),
      length: "long",
      control: "password",
    }),
  });
}

export async function secretList(
  frame = new ScreenFrame(),
): Promise<ScreenResult> {
  while (true) {
    const secrets = await secretStore.list();
    const event = await callScreen({
      id: "core-admin-secrets",
      title: msg("secrets.secrets"),
      description: msg("secrets.manage_credentials_used_by_your_packages_and"),
      schema: SecretList,
      model: frame.model({
        secrets: secrets.map((secret) => ({
          name: secret.name,
          updatedAt: secret.updated_at,
        })),
      }),
      layout: secretListLayout,
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
      title: existing
        ? localizedText(msg("ui.secret_name", { name: name! }))
        : localizedText(msg("secrets.add_secret")),
      schema: secretEditSchema(existing),
      model: frame.model(model),
      layout: secretEditLayout,
      header: {
        actions: [{
          id: "save",
          label: msg("packages.save_secret"),
          kind: "primary",
        }],
      },
    });
    if (event.action === BACK_EVENT) return { view: "back" };
    if (event.action !== "save") continue;
    try {
      const secretName = requiredName(model.name);
      await secretStore.set({
        name: secretName,
        value: requiredValue(model.value),
      });
      model.value = "";
      sendMessage(
        localizedText(
          msg(existing ? "secrets.updated_name" : "secrets.created_name", {
            name: secretName,
          }),
        ),
        "success",
      );
      return { view: "back" };
    } catch (error) {
      model.value = "";
      sendMessage(
        error instanceof Error
          ? error.message
          : localizedText(msg("secrets.secret_update_failed")),
        "error",
      );
    }
  }
}

function requiredName(value: string): string {
  const normalized = value.trim();
  if (normalized === "") {
    throw new TypeError(localizedText(msg("ui.name_is_required")));
  }
  return normalized;
}

function requiredValue(value: string): string {
  if (value === "") {
    throw new TypeError(localizedText(msg("ui.value_is_required")));
  }
  return value;
}
