import { sourceInfo } from "/p/the8020/packages/types/source.ts";
import { field, z } from "/p/the8020/db/fields.ts";

export const sandboxId: z.ZodString = field(z.string(), {
  label: "Sandbox",
  description:
    "A running environment for services and background work. Open it to see activity, resource use, and Workers.",
  valueHelp: async (request) => {
    const { kernel } = await import("@the8020/kernel");
    const { queryValueHelp } = await import("/p/the8020/uui/lists.ts");
    const { sandboxes } = await kernel.admin.execute<{
      sandboxes: Array<{ sandbox_id: string; reason: string; state: string }>;
    }>("sandbox.list");
    const rows = sandboxes.sort((a, b) =>
      a.sandbox_id.localeCompare(b.sandbox_id)
    ).map((row) => ({
      sandboxId: row.sandbox_id,
      state: row.state,
      reason: row.reason,
    }));
    return queryValueHelp(
      z.object({
        sandboxId,
        state: runtimeInfo.shape.state,
        reason: runtimeInfo.shape.reason,
      }),
      rows,
      request,
    );
  },
  open: async (value) => {
    const { default: sandboxes } = await import(
      "../programs/sandboxes/program.ts"
    );
    await sandboxes(value);
  },
});

export const workerId: z.ZodString = field(z.string(), {
  label: "Worker",
  description:
    "A Worker runs a service or background program inside a sandbox. Open it to see its activity and owning workload.",
  open: async (value) => {
    const { default: workers } = await import("../programs/workers/program.ts");
    await workers(value);
  },
});

export const archivedSandboxId = field(sandboxId, {
  label: "Sandbox ID",
  description:
    "The sandbox that produced this archive. Its live environment is no longer available.",
  valueHelp: undefined,
  open: undefined,
});

export const runtimeInfo = z.object({
  sandboxGroup: field(z.string(), {
    label: "Sandbox group",
    description:
      "Compatible workloads in the same group may share a sandbox. Leave empty to use the default placement.",
  }),
  state: field(z.string(), {
    label: "Status",
    description:
      "The observed lifecycle state of this runtime environment or Worker.",
  }),
  type: field(z.string(), {
    label: "Type",
    description: "The kind of work for which this sandbox was created.",
  }),
  reason: field(z.string(), {
    label: "Reason",
    description: "Why this sandbox was created or changed state.",
  }),
  groupKey: field(z.string(), {
    label: "Group key",
    description:
      "The compatibility group used to place work together in this sandbox.",
  }),
  workerCount: field(z.number().int(), {
    label: "Workers",
    description:
      "Number of Workers currently assigned to this environment or workload.",
  }),
  sandboxCount: field(z.number().int(), {
    label: "Sandboxes",
    description: "Number of environments currently hosting this workload.",
  }),
  activeRequests: field(z.number().int().nonnegative(), {
    label: "Active requests",
    description:
      "Requests currently being handled. These may continue while an older version drains.",
  }),
  activeExecutions: field(z.number().int().nonnegative(), {
    label: "Active executions",
    description:
      "Persistent executions still running in this environment, including sessions.",
  }),
  snapshotRevision: field(z.number().int().nonnegative(), {
    label: "Snapshot revision",
    description:
      "Revision of this observed runtime state. Refresh the detail to request a new observation.",
  }),
  snapshotObservedAt: field(z.string(), {
    label: "Snapshot observed",
    description:
      "When this runtime state was last observed. Refresh the detail for a current observation.",
  }),
  failure: field(z.string(), {
    label: "Attention",
    description:
      "The latest reported problem affecting this environment or workload.",
  }),
  memoryBytes: field(z.number().nonnegative(), {
    label: "Memory bytes",
    description: "Current memory use in bytes.",
  }),
  memory: field(z.string(), {
    label: "Memory in use",
    description: "Current memory use, displayed in readable units.",
  }),
  nodeId: field(z.string(), {
    label: "Node",
    description:
      "The node that hosts, or last hosted, this execution environment.",
  }),
  createdAt: field(z.string(), {
    label: "Started",
    description: "When this execution environment started.",
  }),
  cpuMicros: field(z.number().nonnegative(), {
    label: "CPU microseconds",
    description: "Accumulated CPU time used by this sandbox, in microseconds.",
  }),
  pids: field(z.number().nonnegative(), {
    label: "Processes",
    description: "Number of operating-system processes in this sandbox.",
  }),
  owner: field(z.string(), {
    label: "Workload owner",
    description:
      "The program or service that owns this work. This is separate from its execution user.",
  }),
  workload: field(z.string(), {
    label: "Workload ID",
    description:
      "The workload assigned to this Worker; use it to correlate runtime diagnostics.",
  }),
  entrypoint: sourceInfo.shape.entrypoint,
  release: field(z.string(), {
    label: "Release",
    description: "The runtime release used to start this Worker.",
  }),
  debugger: field(z.string(), {
    label: "Debugger name",
    description:
      "The target name used when attaching a debugger to this Worker.",
  }),
  historyId: field(z.string(), {
    label: "History ID",
    description: "Identifier of this archived sandbox record.",
  }),
  archivedAt: field(z.string(), {
    label: "Archived",
    description: "When this sandbox stopped and its history was saved.",
  }),
  expiresAt: field(z.string(), {
    label: "History expires",
    description: "When this archived sandbox record is due to expire.",
  }),
  logStatus: field(z.string(), {
    label: "Log status",
    description:
      "Whether the requested log page is available, partial, expired, or unavailable.",
  }),
  logs: field(z.string(), {
    label: "Logs",
    description:
      "Messages from the selected execution period. Use First, Recent, or Next logs to change the displayed page.",
  }),
});
