import { packageId } from "/p/the8020/packages/types/package.ts";
import { sourceInfo } from "/p/the8020/packages/types/source.ts";
import { msg } from "../i18n/messages.ts";
import { runtimeInfo } from "../types/runtime.ts";
import {
  BACK_EVENT,
  callScreen,
  field,
  Model,
  sendMessage,
  z,
} from "/p/the8020/uui/mod.ts";

export async function packageSync() {
  const { packageDifferences, synchronizeNode } = await import(
    "/p/the8020/packages/src/node-sync.ts"
  );
  const fields = z.object({
    key: z.string(),
    selected: z.boolean(),
    node: runtimeInfo.shape.nodeId,
    packageId,
    before: field(sourceInfo.shape.commit, {
      label: msg("package_management.installed_commit"),
    }),
    desired: field(sourceInfo.shape.commit, {
      label: msg("package_management.version_to_install"),
    }),
  });
  while (true) {
    const rows = await packageDifferences();
    const model = new Model({
      rows: rows.map((row) => ({
        ...row,
        key: row.node + "/" + row.packageId,
        selected: true,
      })),
    });
    const event = await callScreen({
      id: "package-sync",
      title: msg("packages.synchronize"),
      schema: z.object({ rows: z.array(fields) }),
      model,
      layout: {
        schema: 1,
        id: "package-sync",
        root: {
          type: "list",
          bind: "rows",
          key: "key",
          selection: "selected",
          display: ["node", "packageId", "before", "desired"],
          toolbar: [{
            id: "sync",
            label: msg("packages.sync_selected"),
            kind: "primary",
          }, { id: "refresh", label: msg("packages.refresh") }],
        },
      },
    });
    if (event.action === BACK_EVENT) return;
    if (event.action !== "sync") continue;
    const selected = new Set(
      model.data.rows.filter((row) => row.selected).map((row) => row.key),
    );
    for (const row of rows) {
      if (selected.has(row.node + "/" + row.packageId)) {
        try {
          await synchronizeNode(row);
        } catch (cause) {
          sendMessage(
            `${row.node} · ${row.packageId}: ${
              cause instanceof Error ? cause.message : String(cause)
            }`,
            "error",
          );
        }
      }
    }
  }
}
