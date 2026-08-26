import { kernel } from "@platform/kernel";
import { callScreen, field, z } from "@platform/uui";
import sandboxDetailLayout from "./layouts/sandbox-detail.json" with {
  type: "json",
};
import sandboxListLayout from "./layouts/sandbox-list.json" with {
  type: "json",
};
import type { SandboxInspectResult, SandboxListResult } from "./contracts.ts";
import type { ScreenResult } from "./navigation.ts";
import { sandboxDetailModel, sandboxRows } from "./view.ts";

const SandboxRow = z.object({
  sandboxId: z.string(),
  type: z.string(),
  state: z.string(),
  reason: z.string(),
  workers: z.number().int(),
  failure: z.string(),
});
const SandboxList = z.object({ sandboxes: z.array(SandboxRow) });
const ServiceRow = z.object({
  navigation: z.string(),
  serviceId: z.string(),
  state: z.string(),
  enabled: z.boolean(),
  instances: z.number().int(),
  workers: z.number().int(),
});
const SessionRow = z.object({
  sessionId: z.string(),
  type: z.string(),
  user: z.string(),
  serviceId: z.string(),
  state: z.string(),
  workerId: z.string(),
  program: z.string(),
});
const SandboxDetail = z.object({
  sandboxId: field(z.string(), { label: "Sandbox ID", readOnly: true }),
  type: field(z.string(), { label: "Type", readOnly: true }),
  state: field(z.string(), { label: "State", readOnly: true }),
  reason: field(z.string(), { label: "Reason", readOnly: true }),
  runtimeGroupId: field(z.string(), {
    label: "Runtime group",
    readOnly: true,
  }),
  groupKey: field(z.string(), { label: "Group key", readOnly: true }),
  workers: field(z.number().int(), { label: "Workers", readOnly: true }),
  failure: field(z.string(), { label: "Failure", readOnly: true }),
  memoryBytes: field(z.number().nonnegative(), {
    label: "Memory bytes",
    readOnly: true,
  }),
  cpuMicros: field(z.number().nonnegative(), {
    label: "CPU microseconds",
    readOnly: true,
  }),
  pids: field(z.number().nonnegative(), { label: "PIDs", readOnly: true }),
  services: z.array(ServiceRow),
  sessions: z.array(SessionRow),
});

export async function sandboxList(): Promise<ScreenResult> {
  const result = await kernel.admin.execute<SandboxListResult>("sandbox.list");
  const model = { sandboxes: sandboxRows(result) };
  const event = await callScreen({
    id: "core-admin-sandboxes",
    title: "Sandboxes",
    schema: SandboxList,
    model,
    layout: sandboxListLayout,
    actions: [{ id: "back", label: "Back" }],
  });
  return event.action === "select" && typeof event.value === "string"
    ? { view: "sandbox", sandboxId: event.value }
    : { view: "back" };
}

export async function sandboxDetail(sandboxId: string): Promise<ScreenResult> {
  while (true) {
    const result = await kernel.admin.execute<SandboxInspectResult>(
      "sandbox.inspect",
      { sandbox_id: sandboxId },
    );
    const model = sandboxDetailModel(result);
    const event = await callScreen({
      id: "core-admin-sandbox-detail",
      title: sandboxId,
      schema: SandboxDetail,
      model,
      layout: sandboxDetailLayout,
      actions: [
        { id: "refresh", label: "Refresh", kind: "primary" },
        { id: "back", label: "Back" },
      ],
    });
    if (
      event.action === "select" && typeof event.value === "string" &&
      event.value.startsWith("service:")
    ) return { view: "service", serviceId: event.value.slice(8) };
    if (event.action === "back") return { view: "back" };
  }
}
