import { archivedSandboxId, runtimeInfo } from "../types/runtime.ts";
import { serviceInfo } from "/p/the8020/services/types/service.ts";
import { ScreenFrame } from "./screen_frame.ts";
import { kernel, type LogPage } from "@the8020/kernel";
import {
  BACK_EVENT,
  callScreen,
  field,
  Model,
  presentPage,
  z,
} from "/p/the8020/uui/mod.ts";
import { serviceId } from "/p/the8020/services/types/service.ts";
import { sandboxId as sandboxField, workerId } from "../types/runtime.ts";
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
  sandboxId: sandboxField,
  type: runtimeInfo.shape.type,
  state: runtimeInfo.shape.state,
  reason: runtimeInfo.shape.reason,
  workers: runtimeInfo.shape.workerCount,
  failure: runtimeInfo.shape.failure,
});
const SandboxList = z.object({ sandboxes: z.array(SandboxRow) });
const SandboxHistoryRow = z.object({
  historyId: runtimeInfo.shape.historyId,
  sandboxId: archivedSandboxId,
  type: runtimeInfo.shape.type,
  state: runtimeInfo.shape.state,
  reason: runtimeInfo.shape.reason,
  archivedAt: runtimeInfo.shape.archivedAt,
  expiresAt: runtimeInfo.shape.expiresAt,
});
const SandboxHistoryList = z.object({
  sandboxes: z.array(SandboxHistoryRow),
});
const ServiceRow = z.object({
  navigation: z.string(),
  serviceId,
  state: serviceInfo.shape.state,
  enabled: serviceInfo.shape.enabled,
  sandboxes: runtimeInfo.shape.sandboxCount,
  workers: runtimeInfo.shape.workerCount,
});
const SandboxDetail = z.object({
  sandboxId: field(sandboxField, {
    open: undefined,
    length: "long",
    readOnly: true,
  }),
  type: field(runtimeInfo.shape.type, { length: "short", readOnly: true }),
  state: field(runtimeInfo.shape.state, {
    label: "State",
    length: "short",
    readOnly: true,
  }),
  reason: field(runtimeInfo.shape.reason, { length: "long", readOnly: true }),
  groupKey: field(runtimeInfo.shape.groupKey, { readOnly: true }),
  workers: field(runtimeInfo.shape.workerCount, {
    length: "short",
    readOnly: true,
  }),
  activeRequests: field(runtimeInfo.shape.activeRequests, {
    length: "short",
    readOnly: true,
  }),
  activeExecutions: field(runtimeInfo.shape.activeExecutions, {
    length: "short",
    readOnly: true,
  }),
  snapshotRevision: field(runtimeInfo.shape.snapshotRevision, {
    length: "short",
    readOnly: true,
  }),
  snapshotObservedAt: field(runtimeInfo.shape.snapshotObservedAt, {
    length: "long",
    readOnly: true,
  }),
  failure: field(runtimeInfo.shape.failure, {
    label: "Failure",
    length: "long",
    readOnly: true,
  }),
  memoryBytes: field(runtimeInfo.shape.memoryBytes, {
    length: "short",
    readOnly: true,
  }),
  memory: field(runtimeInfo.shape.memory, { readOnly: true }),
  nodeId: field(runtimeInfo.shape.nodeId, { readOnly: true }),
  createdAt: field(runtimeInfo.shape.createdAt, { readOnly: true }),
  workerRows: z.array(z.object({
    workerId,
    owner: runtimeInfo.shape.owner,
    state: runtimeInfo.shape.state,
    requests: runtimeInfo.shape.activeRequests,
  })),
  cpuMicros: field(runtimeInfo.shape.cpuMicros, {
    length: "short",
    readOnly: true,
  }),
  pids: field(runtimeInfo.shape.pids, {
    label: "PIDs",
    length: "short",
    readOnly: true,
  }),
  services: z.array(ServiceRow),
});
const SandboxHistoryDetail = z.object({
  nodeId: field(runtimeInfo.shape.nodeId, { label: "Node ID", readOnly: true }),
  createdAt: field(runtimeInfo.shape.createdAt, {
    label: "Created",
    readOnly: true,
  }),
  historyId: field(runtimeInfo.shape.historyId, {
    length: "long",
    readOnly: true,
  }),
  sandboxId: field(archivedSandboxId, {
    label: "Sandbox ID",
    length: "long",
    readOnly: true,
  }),
  type: field(runtimeInfo.shape.type, { length: "short", readOnly: true }),
  state: field(runtimeInfo.shape.state, {
    label: "Final state",
    length: "short",
    readOnly: true,
  }),
  reason: field(runtimeInfo.shape.reason, {
    label: "Cleanup reason",
    length: "long",
    readOnly: true,
  }),
  failure: field(runtimeInfo.shape.failure, {
    label: "Failure",
    length: "long",
    readOnly: true,
  }),
  archivedAt: field(runtimeInfo.shape.archivedAt, { readOnly: true }),
  expiresAt: field(runtimeInfo.shape.expiresAt, { readOnly: true }),
  logStatus: field(runtimeInfo.shape.logStatus, {
    length: "long",
    readOnly: true,
  }),
  logs: field(runtimeInfo.shape.logs, {
    control: "textarea",
    rowSpan: 8,
    length: "long",
    readOnly: true,
  }),
});

export async function sandboxList(
  frame = new ScreenFrame(),
): Promise<ScreenResult> {
  while (true) {
    const result = await kernel.admin.execute<SandboxListResult>(
      "sandbox.list",
    );
    const model = { sandboxes: sandboxRows(result) };
    const event = await callScreen({
      id: "core-admin-sandboxes",
      title: "Sandboxes",
      schema: SandboxList,
      model: frame.model(model),
      layout: sandboxListLayout,
      header: {
        actions: [
          { id: "workers", label: "Workers" },
          { id: "history", label: "History" },
          { id: "refresh", label: "[[icon=refresh]] Refresh" },
        ],
      },
    });
    if (event.action === "workers") return { view: "workers" };
    if (event.action === "history") return { view: "sandboxHistory" };
    if (event.action === BACK_EVENT) return { view: "back" };
    if (event.action === "refresh") continue;
    return event.action === "select" && typeof event.value === "string"
      ? { view: "sandbox", sandboxId: event.value }
      : { view: "back" };
  }
}

export async function sandboxHistoryList(
  frame = new ScreenFrame(),
): Promise<ScreenResult> {
  const context = frame.context({ before: "" });
  while (true) {
    const result = await kernel.admin.execute<SandboxHistoryListResult>(
      "sandbox.history.list",
      { limit: 100, before: context.before },
    );
    const event = await callScreen({
      id: "core-admin-sandbox-history",
      title: "Sandbox history",
      schema: SandboxHistoryList,
      model: frame.model({ sandboxes: sandboxHistoryRows(result) }),
      layout: sandboxHistoryListLayout,
      header: {
        actions: result.next_cursor
          ? [{ id: "older", label: "Older" } as const]
          : [],
      },
    });
    if (event.action === "older") {
      context.before = result.next_cursor;
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
  frame = new ScreenFrame(),
): Promise<ScreenResult> {
  const view = frame.context<{ cursor?: string; tail?: boolean }>({});
  while (true) {
    const result = await kernel.admin.execute<SandboxHistoryInspectResult>(
      "sandbox.history.inspect",
      { history_id: historyId },
    );
    const record = result.sandbox_history.record;
    let page: LogPage;
    try {
      page = await kernel.logs.query({
        node_id: record.status.node_id,
        sandbox_id: record.spec.sandbox_id,
        from: record.status.created_at,
        until: record.archived_at,
        position: view.cursor || view.tail
          ? undefined
          : record.status.log_position,
        cursor: view.cursor,
        tail: view.tail,
        limit: 100,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      page = {
        state: "unavailable",
        records: [],
        more: false,
        scanned_bytes: 0,
      };
    }
    const event = await callScreen({
      id: "core-admin-sandbox-history-detail",
      title:
        `Archived sandbox ${result.sandbox_history.record.spec.sandbox_id}`,
      schema: SandboxHistoryDetail,
      model: frame.model(sandboxHistoryDetailModel(result, page)),
      layout: sandboxHistoryDetailLayout,
      header: {
        actions: [
          { id: "refresh", label: "Refresh", kind: "primary" },
          { id: "advanced", label: "Advanced" },
          { id: "first", label: "First logs" },
          { id: "recent", label: "Recent logs" },
          ...(page.state === "ok" && page.more && page.cursor
            ? [{ id: "next", label: "Next logs" }]
            : []),
        ],
      },
    });
    if (event.action === BACK_EVENT) return { view: "back" };
    if (event.action === "advanced") {
      await presentPage(() =>
        callScreen({
          id: "core-admin-sandbox-history-advanced",
          title: "Archive details",
          schema: SandboxHistoryDetail,
          model: new Model(sandboxHistoryDetailModel(result, page)),
          controls: ["historyId", "sandboxId", "nodeId", "createdAt", "type"]
            .map((bind) => ({ bind })),
        })
      );
    } else if (event.action === "first") {
      view.cursor = undefined;
      view.tail = undefined;
    } else if (event.action === "recent") {
      view.cursor = undefined;
      view.tail = true;
    } else if (event.action === "next" && page.cursor && page.more) {
      view.cursor = page.cursor;
      view.tail = undefined;
    }
  }
}

export async function sandboxDetail(
  sandboxId: string,
  frame = new ScreenFrame(),
): Promise<ScreenResult> {
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
      model: frame.model(model),
      controls: [
        "state",
        "type",
        "reason",
        "workers",
        "activeRequests",
        "activeExecutions",
        "memory",
        "failure",
      ].map((bind) => ({ bind, hidden: bind === "failure" && !model.failure })),
      layout: {
        ...sandboxDetailLayout,
        root: {
          ...sandboxDetailLayout.root,
          children: sandboxDetailLayout.root.children.filter((item) =>
            item.id !== "services" || model.services.length > 0
          ),
        },
      },
      header: {
        actions: [{
          id: "refresh",
          label: "[[icon=refresh]] Refresh",
          kind: "primary",
        }, { id: "advanced", label: "Advanced" }],
      },
    });
    if (
      event.action === "select" && typeof event.value === "string" &&
      event.value.startsWith("service:")
    ) return { view: "service", serviceId: event.value.slice(8) };
    if (event.action === BACK_EVENT) return { view: "back" };
    if (
      event.action === "select" && typeof event.value === "string" &&
      event.controlId === "workers"
    ) {
      return { view: "worker", workerId: event.value };
    }
    if (event.action === "advanced") {
      await presentPage(() =>
        callScreen({
          id: "core-admin-sandbox-advanced",
          title: `Advanced · ${sandboxId}`,
          schema: SandboxDetail,
          model: new Model(model),
          controls: [
            "sandboxId",
            "nodeId",
            "createdAt",
            "groupKey",
            "snapshotRevision",
            "snapshotObservedAt",
            "memoryBytes",
            "cpuMicros",
            "pids",
          ].map((bind) => ({ bind })),
        })
      );
    }
    if (event.action === "refresh") {
      result = await kernel.admin.execute<SandboxInspectResult>(
        "sandbox.refresh",
        { sandbox_id: sandboxId },
      );
    }
  }
}
