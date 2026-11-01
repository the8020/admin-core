import { msg } from "/p/the8020/admin-core/i18n/messages.ts";
import { sourceInfo } from "/p/the8020/packages/types/source.ts";
import { choiceHelp, field, z } from "/p/the8020/db/fields.ts";

export const sandboxId: z.ZodString = field(z.string(), {
  label: msg("runtime.sandbox"),
  description: msg("runtime.a_running_environment_for_services_and_background"),
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
  label: msg("runtime.worker"),
  description: msg("runtime.a_worker_runs_a_service_or_background"),
  open: async (value) => {
    const { default: workers } = await import("../programs/workers/program.ts");
    await workers(value);
  },
});

export const archivedSandboxId = field(sandboxId, {
  label: msg("sandboxes.sandbox_id"),
  description: msg("runtime.the_sandbox_that_produced_this_archive_its"),
  valueHelp: undefined,
  open: undefined,
});

export const runtimeInfo = z.object({
  sandboxGroup: field(z.string(), {
    label: msg("runtime.sandbox_group"),
    description: msg("runtime.compatible_workloads_in_the_same_group_may"),
  }),
  state: field(z.string(), {
    label: msg("runtime.status"),
    description: msg("runtime.the_observed_lifecycle_state_of_this_runtime"),
    valueHelp: choiceHelp(z.string(), [
      "CREATING",
      "STARTING",
      "READY",
      "ACTIVE",
      "DRAINING",
      "STOPPING",
      "STOPPED",
      "FAILED",
      "DELETING",
    ]),
  }),
  workerState: field(z.string(), {
    label: msg("runtime.status"),
    description: msg("runtime.the_observed_lifecycle_state_of_this_worker"),
    valueHelp: choiceHelp(z.string(), [
      "starting",
      "ready",
      "stopping",
      "stopped",
      "failed",
    ]),
  }),
  type: field(z.string(), {
    label: msg("runtime.type"),
    description: msg("runtime.the_kind_of_work_for_which_this"),
    valueHelp: choiceHelp(z.string(), ["service", "job"]),
  }),
  reason: field(z.string(), {
    label: msg("runtime.reason"),
    description: msg("runtime.why_this_sandbox_was_created_or_changed"),
  }),
  groupKey: field(z.string(), {
    label: msg("runtime.group_key"),
    description: msg("runtime.the_compatibility_group_used_to_place_work"),
  }),
  workerCount: field(z.number().int(), {
    label: msg("sandboxes.workers"),
    description: msg("runtime.number_of_workers_currently_assigned_to_this"),
  }),
  sandboxCount: field(z.number().int(), {
    label: msg("sandboxes.sandboxes"),
    description: msg(
      "runtime.number_of_environments_currently_hosting_this_workload",
    ),
  }),
  activeRequests: field(z.number().int().nonnegative(), {
    label: msg("runtime.active_requests"),
    description: msg(
      "runtime.requests_currently_being_handled_these_may_continue",
    ),
  }),
  activeExecutions: field(z.number().int().nonnegative(), {
    label: msg("runtime.active_executions"),
    description: msg(
      "runtime.persistent_executions_still_running_in_this_environment",
    ),
  }),
  snapshotRevision: field(z.number().int().nonnegative(), {
    label: msg("runtime.snapshot_revision"),
    description: msg("runtime.revision_of_this_observed_runtime_state_refresh"),
  }),
  snapshotObservedAt: field(z.string(), {
    label: msg("runtime.snapshot_observed"),
    description: msg("runtime.when_this_runtime_state_was_last_observed"),
  }),
  failure: field(z.string(), {
    label: msg("runtime.attention"),
    description: msg(
      "runtime.the_latest_reported_problem_affecting_this_environment",
    ),
  }),
  memoryBytes: field(z.number().nonnegative(), {
    label: msg("runtime.memory_bytes"),
    description: msg("runtime.current_memory_use_in_bytes"),
  }),
  memory: field(z.string(), {
    label: msg("runtime.ram_in_use"),
    description: msg("runtime.total_sandbox_memory_use_displayed_in_readable"),
  }),
  heap: field(z.string(), {
    label: msg("runtime.heap_used"),
    description: msg("runtime.javascript_heap_in_use_by_the_live"),
  }),
  cpu: field(z.string(), {
    label: msg("runtime.cpu_time"),
    description: msg("runtime.accumulated_cpu_time_sandbox_totals_include_the"),
  }),
  resourceSampledAt: field(z.string(), {
    label: msg("runtime.resources_measured"),
    description: msg("runtime.time_of_the_oldest_resource_sample_shown"),
  }),
  nodeId: field(z.string(), {
    label: msg("kernel_logs.node"),
    description: msg("runtime.the_node_that_hosts_or_last_hosted"),
  }),
  createdAt: field(z.string(), {
    label: msg("runtime.started"),
    description: msg("runtime.when_this_execution_environment_started"),
  }),
  cpuMicros: field(z.number().nonnegative(), {
    label: msg("runtime.cpu_microseconds"),
    description: msg("runtime.accumulated_cpu_time_used_by_this_sandbox"),
  }),
  pids: field(z.number().nonnegative(), {
    label: msg("runtime.processes"),
    description: msg("runtime.number_of_operating_system_processes_in_this"),
  }),
  owner: field(z.string(), {
    label: msg("runtime.workload_owner"),
    description: msg("runtime.the_program_or_service_that_owns_this"),
  }),
  workload: field(z.string(), {
    label: msg("runtime.workload_id"),
    description: msg("runtime.the_workload_assigned_to_this_worker_use"),
  }),
  entrypoint: sourceInfo.shape.entrypoint,
  release: field(z.string(), {
    label: msg("runtime.release"),
    description: msg("runtime.the_runtime_release_used_to_start_this"),
  }),
  debugger: field(z.string(), {
    label: msg("runtime.debugger_name"),
    description: msg("runtime.the_target_name_used_when_attaching_a"),
  }),
  historyId: field(z.string(), {
    label: msg("runtime.history_id"),
    description: msg("runtime.identifier_of_this_archived_sandbox_record"),
  }),
  archivedAt: field(z.string(), {
    label: msg("runtime.archived"),
    description: msg("runtime.when_this_sandbox_stopped_and_its_history"),
  }),
  expiresAt: field(z.string(), {
    label: msg("runtime.history_expires"),
    description: msg("runtime.when_this_archived_sandbox_record_is_due"),
  }),
  logStatus: field(z.string(), {
    label: msg("runtime.log_status"),
    description: msg("runtime.whether_the_requested_log_page_is_available"),
  }),
  logs: field(z.string(), {
    label: msg("runtime.logs"),
    description: msg("runtime.messages_from_the_selected_execution_period_use"),
  }),
});
