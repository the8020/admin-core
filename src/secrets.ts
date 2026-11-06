import { text as localizedText } from "/p/the8020/i18n/mod.ts";
import { msg } from "/p/the8020/admin-core/i18n/messages.ts";
import {
  SecretInUseError,
  secrets as secretStore,
} from "/p/the8020/secrets/src/admin.ts";
import type {
  SecretUsage,
  SecretUsageProblem,
} from "/p/the8020/secrets/src/usages.ts";
import { secretInfo } from "/p/the8020/secrets/types/secret.ts";
import { ScreenFrame } from "./screen_frame.ts";
import {
  BACK_EVENT,
  callScreen,
  confirmAction,
  field,
  invokeProgram,
  Model,
  presentModal,
  presentPage,
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
const UsageRow = z.object({
  key: z.string(),
  title: field(z.string(), {
    label: msg("secrets.usage_place"),
    description: msg("secrets.where_the_secret_is_used_open_it"),
  }),
  detail: field(z.string(), {
    label: msg("secrets.usage_detail"),
    description: msg("secrets.what_the_secret_is_used_for"),
  }),
  packageId: field(z.string(), {
    label: msg("secrets.usage_package"),
    description: msg("secrets.the_package_that_uses_the_secret"),
  }),
});
const UsageList = z.object({ usages: z.array(UsageRow) });

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
        actions: [
          {
            id: "save",
            label: msg("packages.save_secret"),
            kind: "primary",
          },
          ...(existing
            ? [
              { id: "usages", label: msg("secrets.where_used") },
              {
                id: "delete",
                label: msg("secrets.delete_secret"),
                kind: "danger" as const,
              },
            ]
            : []),
        ],
      },
    });
    if (event.action === BACK_EVENT) return { view: "back" };
    if (existing && event.action === "usages") {
      await withErrors(async () => {
        const found = await secretStore.usages(name!);
        await showUsages(name!, found.usages, found.problems, false);
      });
      continue;
    }
    if (existing && event.action === "delete") {
      if (await deleteSecret(name!)) return { view: "back" };
      continue;
    }
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

/** Deletes after confirmation; a used secret shows its usages instead. */
async function deleteSecret(name: string): Promise<boolean> {
  let deleted = false;
  await withErrors(async () => {
    const found = await secretStore.usages(name);
    if (found.usages.length > 0 || found.problems.length > 0) {
      await showUsages(name, found.usages, found.problems, true);
      return;
    }
    const confirmed = await confirmAction({
      id: "core-admin-secret-delete",
      title: localizedText(msg("secrets.delete_secret_name", { name })),
      message: localizedText(msg("secrets.the_value_is_removed_permanently")),
      confirm: localizedText(msg("secrets.delete_secret")),
    });
    if (!confirmed) return;
    try {
      await secretStore.delete(name);
    } catch (error) {
      // Something started using it after the check above.
      if (!(error instanceof SecretInUseError)) throw error;
      await showUsages(name, error.usages, error.problems, true);
      return;
    }
    sendMessage(
      localizedText(msg("secrets.deleted_name", { name })),
      "success",
    );
    deleted = true;
  });
  return deleted;
}

async function showUsages(
  name: string,
  usages: SecretUsage[],
  problems: SecretUsageProblem[],
  blocked: boolean,
) {
  for (const problem of problems) {
    sendMessage(
      localizedText(msg("secrets.could_not_check_package", {
        package: problem.packageId,
        message: problem.message,
      })),
      "warning",
    );
  }
  const model = new Model({
    usages: usages.map((usage, index) => ({
      key: String(index),
      title: usage.title,
      detail: usage.detail,
      packageId: usage.packageId,
    })),
  });
  while (true) {
    const event = await presentModal(() =>
      callScreen({
        id: "core-admin-secret-usages",
        title: localizedText(
          blocked
            ? msg("secrets.name_cannot_be_deleted", { name })
            : msg("secrets.where_name_is_used", { name }),
        ),
        description: localizedText(
          usages.length === 0
            ? problems.length > 0
              ? msg("secrets.some_packages_could_not_be_checked")
              : msg("secrets.no_installed_package_uses_this_secret")
            : blocked
            ? msg("secrets.remove_the_secret_from_these_places")
            : msg("secrets.open_a_place_to_see_or_change"),
        ),
        schema: UsageList,
        model,
        layout: {
          schema: 1,
          id: "secret-usages",
          root: {
            id: "usages",
            type: "list",
            bind: "usages",
            key: "key",
            display: ["title", "detail", "packageId"],
          },
        },
      })
    );
    if (event.action !== "select" || typeof event.value !== "string") return;
    const target = usages[Number(event.value)]?.open;
    if (target) {
      await withErrors(() =>
        presentPage(() => invokeProgram(target.program, target.arguments))
      );
    }
  }
}

async function withErrors(action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    sendMessage(
      error instanceof Error
        ? error.message
        : localizedText(msg("secrets.secret_update_failed")),
      "error",
    );
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
