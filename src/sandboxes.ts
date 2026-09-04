import { kernel } from "@the8020/kernel";
import { BACK_EVENT, callScreen, field, z } from "@packages/the8020/uui/mod.ts";
import sandboxDetailLayout from "./layouts/sandbox-detail.json" with {
  type: "json",
};
import sandboxHistoryDetailLayout from "./layouts/sandbox-history-detail.json" with {
  type: "json",
};
import sandboxHistoryListLayout from "./layouts/sandbox-history-list.json" with {
  type: "json",
};
import sandboxListLayout from "./layouts/sandbox-list.json" with {
  type: "json",
};
import type {
  SandboxHistoryInspectResult,
  SandboxHistoryListResult,
  SandboxInspectResult,
  SandboxListResult,
} from "./contracts.ts";
import type { ScreenResult } from "./navigation.ts";
import {
  sandboxDetailModel,
  sandboxHistoryDetailModel,
  sandboxHistoryRows,
  sandboxRows,
} from "./view.ts";

const SandboxRow = z.object({
  sandboxId: z.string(),
  type: z.string(),
  state: z.string(),
  reason: z.string(),
  workers: z.number().int(),
  failure: z.string(),
});
const SandboxList = z.object({ sandboxes: z.array(SandboxRow) });
const SandboxHistoryRow = z.object({
  historyId: z.string(),
  sandboxId: z.string(),
  type: z.string(),
  state: z.string(),
  reason: z.string(),
  archivedAt: z.string(),
  expiresAt: z.string(),
  logs: z.number().int(),
  logBytes: z.number().int(),
});
const SandboxHistoryList = z.object({
  sandboxes: z.array(SandboxHistoryRow),
});
const ServiceRow = z.object({
  navigation: z.string(),
  serviceId: z.string(),
  state: z.string(),
  enabled: z.boolean(),
  sandboxes: z.number().int(),
  workers: z.number().int(),
});
const SandboxDetail = z.object({
  sandboxId: field(z.string(), {
    label: "Sandbox ID",
    length: "long",
    readOnly: true,
  }),
  type: field(z.string(), { label: "Type", length: "short", readOnly: true }),
  state: field(z.string(), { label: "State", length: "short", readOnly: true }),
  reason: field(z.string(), {
    label: "Reason",
    length: "long",
    readOnly: true,
  }),
  runtimeGroupId: field(z.string(), {
    label: "Runtime group",
    length: "long",
    readOnly: true,
  }),
  groupKey: field(z.string(), { label: "Group key", readOnly: true }),
  workers: field(z.number().int(), {
    label: "Workers",
    length: "short",
    readOnly: true,
  }),
  activeRequests: field(z.number().int().nonnegative(), {
    label: "Active requests",
    length: "short",
    readOnly: true,
  }),
  activeExecutions: field(z.number().int().nonnegative(), {
    label: "Active executions",
    length: "short",
    readOnly: true,
  }),
  snapshotRevision: field(z.number().int().nonnegative(), {
    label: "Snapshot revision",
    length: "short",
    readOnly: true,
  }),
  snapshotObservedAt: field(z.string(), {
    label: "Snapshot observed",
    length: "long",
    readOnly: true,
  }),
  failure: field(z.string(), {
    label: "Failure",
    length: "long",
    readOnly: true,
  }),
  memoryBytes: field(z.number().nonnegative(), {
    label: "Memory bytes",
    length: "short",
    readOnly: true,
  }),
  cpuMicros: field(z.number().nonnegative(), {
    label: "CPU microseconds",
    length: "short",
    readOnly: true,
  }),
  pids: field(z.number().nonnegative(), {
    label: "PIDs",
    length: "short",
    readOnly: true,
  }),
  services: z.array(ServiceRow),
});
const SandboxHistoryLog = z.object({
  name: z.string(),
  size: z.number().int(),
  truncated: z.boolean(),
  content: z.string(),
});
const SandboxHistoryDetail = z.object({
  historyId: field(z.string(), {
    label: "History ID",
    length: "long",
    readOnly: true,
  }),
  sandboxId: field(z.string(), {
    label: "Sandbox ID",
    length: "long",
    readOnly: true,
  }),
  runtimeGroupId: field(z.string(), {
    label: "Runtime group",
    length: "long",
    readOnly: true,
  }),
  type: field(z.string(), { label: "Type", length: "short", readOnly: true }),
  state: field(z.string(), {
    label: "Final state",
    length: "short",
    readOnly: true,
  }),
  reason: field(z.string(), {
    label: "Cleanup reason",
    length: "long",
    readOnly: true,
  }),
  failure: field(z.string(), {
    label: "Failure",
    length: "long",
    readOnly: true,
  }),
  archivedAt: field(z.string(), { label: "Archived", readOnly: true }),
  expiresAt: field(z.string(), { label: "Expires", readOnly: true }),
  logs: z.array(SandboxHistoryLog),
});

export async function sandboxList(): Promise<ScreenResult> {
  while (true) {
    const result = await kernel.admin.execute<SandboxListResult>(
      "sandbox.list",
    );
    const model = { sandboxes: sandboxRows(result) };
    const event = await callScreen({
      id: "core-admin-sandboxes",
      title: "Sandboxes",
      schema: SandboxList,
      model,
      layout: sandboxListLayout,
      header: {
        actions: [
          { id: "history", label: "History" },
          { id: "refresh", label: "[[icon=refresh]] Refresh" },
        ],
      },
    });
    if (event.action === "history") return { view: "sandboxHistory" };
    if (event.action === BACK_EVENT) return { view: "back" };
    if (event.action === "refresh") continue;
    return event.action === "select" && typeof event.value === "string"
      ? { view: "sandbox", sandboxId: event.value }
      : { view: "back" };
  }
}

export async function sandboxHistoryList(): Promise<ScreenResult> {
  let before = "";
  while (true) {
    const result = await kernel.admin.execute<SandboxHistoryListResult>(
      "sandbox.history.list",
      { limit: 100, before },
    );
    const event = await callScreen({
      id: "core-admin-sandbox-history",
      title: "Sandbox history",
      schema: SandboxHistoryList,
      model: { sandboxes: sandboxHistoryRows(result) },
      layout: sandboxHistoryListLayout,
      header: {
        actions: result.next_cursor
          ? [{ id: "older", label: "Older" } as const]
          : [],
      },
    });
    if (event.action === "older") {
      before = result.next_cursor;
      continue;
    }
    if (event.action === BACK_EVENT) return { view: "back" };
    return event.action === "select" && typeof event.value === "string"
      ? { view: "sandboxHistoryDetail", historyId: event.value }
      : { view: "back" };
  }
}

export async function sandboxHistoryDetail(
  historyId: string,
): Promise<ScreenResult> {
  while (true) {
    const result = await kernel.admin.execute<SandboxHistoryInspectResult>(
      "sandbox.history.inspect",
      { history_id: historyId },
    );
    const event = await callScreen({
      id: "core-admin-sandbox-history-detail",
      title:
        `Archived sandbox ${result.sandbox_history.record.spec.sandbox_id}`,
      schema: SandboxHistoryDetail,
      model: sandboxHistoryDetailModel(result),
      layout: sandboxHistoryDetailLayout,
      header: {
        actions: [{ id: "refresh", label: "Refresh", kind: "primary" }],
      },
    });
    if (event.action === BACK_EVENT) return { view: "back" };
  }
}

export async function sandboxDetail(sandboxId: string): Promise<ScreenResult> {
  let result = await kernel.admin.execute<SandboxInspectResult>(
    "sandbox.inspect",
    { sandbox_id: sandboxId },
  );
  while (true) {
    const model = sandboxDetailModel(result);
    const event = await callScreen({
      id: "core-admin-sandbox-detail",
      title: `Sandbox ${sandboxId}`,
      schema: SandboxDetail,
      model,
      layout: sandboxDetailLayout,
      header: {
        actions: [{ id: "refresh", label: "Refresh", kind: "primary" }],
      },
    });
    if (
      event.action === "select" && typeof event.value === "string" &&
      event.value.startsWith("service:")
    ) return { view: "service", serviceId: event.value.slice(8) };
    if (event.action === BACK_EVENT) return { view: "back" };
    if (event.action === "refresh") {
      result = await kernel.admin.execute<SandboxInspectResult>(
        "sandbox.refresh",
        { sandbox_id: sandboxId },
      );
    }
  }
}
