import { text } from "/p/the8020/i18n/mod.ts";
import { packages } from "/p/the8020/packages/src/admin.ts";
import { sourceInfo } from "/p/the8020/packages/types/source.ts";
import { msg } from "../i18n/messages.ts";
import {
  BACK_EVENT,
  callScreen,
  confirmAction,
  field,
  Model,
  sendMessage,
  z,
} from "/p/the8020/uui/mod.ts";

export async function packageRepair(
  id: string,
  source: string,
  secret: string,
) {
  const model = new Model({
    source,
    secret,
    commit: "",
    versions: [] as { commit: string; subject: string }[],
  });
  while (true) {
    const event = await callScreen({
      id: "package-repair",
      title: msg("packages.repair_upstream"),
      schema: z.object({
        source: sourceInfo.shape.source,
        secret: sourceInfo.shape.secretName,
        commit: sourceInfo.shape.commit,
        versions: z.array(
          z.object({
            commit: field(sourceInfo.shape.commit, { readOnly: true }),
            subject: field(sourceInfo.shape.subject, { readOnly: true }),
          }),
        ),
      }),
      model,
      layout: {
        schema: 1,
        id: "package-repair",
        root: {
          type: "stack",
          children: [{
            type: "field-group",
            controls: ["source", "secret", "commit"],
          }, {
            type: "list",
            bind: "versions",
            key: "commit",
            display: ["subject", "commit"],
          }],
        },
      },
      header: {
        actions: [{ id: "fetch", label: msg("packages.fetch") }, {
          id: "apply",
          label: msg("packages.repair_upstream"),
          kind: "danger",
        }],
      },
    });
    if (event.action === BACK_EVENT) return;
    if (event.action === "select" && typeof event.value === "string") {
      model.data.commit = event.value;
      continue;
    }
    if (event.action !== "fetch" && event.action !== "apply") continue;
    const apply = event.action === "apply";
    if (apply && !model.data.commit) {
      sendMessage(
        text(
          msg("ui.select_a_value1", {
            value1: text(msg("packages.current_commit")),
          }),
        ),
        "error",
      );
      continue;
    }
    if (
      !await confirmAction({
        id: "confirm-upstream",
        title: msg("packages.repair_upstream"),
        message: `${id}\n${model.data.source}\n${
          apply ? model.data.commit : ""
        }`,
        confirm: msg(apply ? "packages.repair_upstream" : "packages.fetch"),
        cancel: msg("packages.cancel"),
      })
    ) continue;
    try {
      const result = await packages.repair(id, {
        source: model.data.source,
        secret: model.data.secret,
        commit: apply ? model.data.commit : undefined,
        confirm: true,
      });
      if (typeof result === "string") {
        sendMessage(
          text(
            msg("package_management.synchronized_packageid", { packageId: id }),
          ),
          "success",
        );
        return;
      }
      model.data.versions = result.versions.map((row) => ({
        commit: row.commit,
        subject: row.subject,
      }));
    } catch (error) {
      sendMessage(
        error instanceof Error ? error.message : String(error),
        "error",
      );
    }
  }
}
