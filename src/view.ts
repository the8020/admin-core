import type { PackageRepository } from "@the8020/kernel";
import type {
  PackageInspectResult,
  PackageListResult,
  SandboxHistoryInspectResult,
  SandboxHistoryListResult,
  SandboxInspectResult,
  SandboxListResult,
  ServiceInspectResult,
  ServiceListResult,
} from "./contracts.ts";

export function packageRows(result: PackageListResult) {
  return (result.packages ?? []).map((item) => ({
    canonicalName: item.package_id,
    valid: item.valid,
    services: item.service_count,
    description: item.description ?? item.validation_error ?? "",
  }));
}

export function packageDetailModel(
  result: PackageInspectResult,
  repository: PackageRepository,
  secretName = "",
) {
  const item = result.package;
  const services = item.services ?? [];
  const programs = item.programs ?? [];
  const files = item.files ?? [];
  return {
    packageId: item.package_id,
    path: item.path,
    description: item.description ?? "",
    documentationUrl: item.documentation_url ?? "",
    license: item.license ?? "",
    valid: item.valid,
    serviceCount: item.service_count,
    programCount: programs.length,
    fileCount: files.length,
    validation: (item.validation_errors ?? []).join("; "),
    inspection: [
      ...(item.inspection_errors ?? []),
      ...(item.contents_truncated
        ? [`Content inventory stopped at ${files.length} visible files`]
        : []),
    ].join("; "),
    repositoryStatus: repository.status,
    activationReady: repository.activation_ready,
    clean: repository.clean,
    branch: repository.branch ?? "",
    head: repository.head ?? "",
    remoteName: repository.remote_name ?? "",
    remoteUrl: repository.remote_url ?? "",
    secretName,
    services: services.map((service) => ({
      navigation: `service:${service.service_id}`,
      serviceId: service.service_id,
      path: service.path,
      serviceType: service.service_type ?? "",
      access: service.access_mode ?? "",
      entrypoint: service.entrypoint ?? "",
      valid: service.valid,
      description: service.description ??
        (service.validation_errors ?? []).join("; "),
    })),
    programs: programs.map((program) => ({
      programId: program.program_id,
      path: program.path,
      entrypoint: program.entrypoint ?? "",
      defaultLayout: program.default_layout ?? "",
      discoverable: program.discoverable,
      valid: program.valid,
      description: program.description ??
        (program.validation_errors ?? []).join("; "),
    })),
    files: files.map((file) => ({
      path: file.path,
      type: file.type,
      size: file.size,
    })),
  };
}

export function serviceRows(result: ServiceListResult) {
  return result.services.map((service) => ({
    serviceId: service.service_id,
    state: service.state,
    enabled: service.enabled,
    versions: service.version_count,
    sandboxes: service.sandbox_count,
    workers: service.worker_count,
    serviceType: service.service_type,
    description: service.description ?? service.validation_error ?? "",
  }));
}

export function serviceDetailModel(
  result: ServiceInspectResult,
) {
  const service = result.service;
  const configuration = service.effective_configuration;
  return {
    serviceId: service.service_id,
    description: service.description ?? "",
    path: service.canonical_base_path,
    state: service.state,
    enabled: service.enabled,
    serviceType: configuration.lifecycle.service_type,
    accessMode: service.access_mode,
    desiredVersion: service.desired_version,
    loadedVersion: service.loaded_version,
    minimumWorkers: configuration.scaling.minimum_workers,
    maximumWorkers: configuration.scaling.maximum_workers,
    concurrencyPerWorker: configuration.scaling.concurrency_per_worker,
    targetUtilization: configuration.scaling.target_utilization * 100,
    workerKeepAlive: formatDuration(configuration.scaling.worker_keep_alive),
    sandboxGroup: configuration.placement.sandbox_group,
    minimumSandboxes: configuration.placement.minimum_sandboxes,
    workersPerSandbox: configuration.placement.workers_per_sandbox,
    sessionKeepAlive: formatDuration(
      configuration.lifecycle.session_keep_alive,
    ),
    failure: service.validation_error ?? service.last_startup_error ??
      service.capacity_reason ?? "",
    sandboxes: (service.sandboxes ?? []).map((sandbox) => ({
      navigation: `sandbox:${sandbox.sandbox_id}`,
      sandboxId: sandbox.sandbox_id,
      version: sandbox.version,
      state: service.state,
      workers: sandbox.worker_ids?.length ?? 0,
      activeRequests: sandbox.active_requests,
      activeExecutions: sandbox.active_executions,
    })),
  };
}

export function sandboxRows(result: SandboxListResult) {
  return result.sandboxes.map((sandbox) => ({
    sandboxId: sandbox.sandbox_id,
    type: sandbox.workload_type,
    state: sandbox.state,
    reason: sandbox.reason,
    workers: sandbox.worker_count,
    failure: sandbox.failure ?? "",
  }));
}

export function sandboxHistoryRows(result: SandboxHistoryListResult) {
  return (result.sandboxes ?? []).map((sandbox) => ({
    historyId: sandbox.history_id,
    sandboxId: sandbox.sandbox_id,
    type: sandbox.workload_type,
    state: sandbox.state,
    reason: sandbox.reason ?? sandbox.failure_reason ?? "",
    archivedAt: sandbox.archived_at,
    expiresAt: sandbox.expires_at,
    logs: sandbox.log_files,
    logBytes: sandbox.log_bytes,
  }));
}

export function sandboxHistoryDetailModel(
  result: SandboxHistoryInspectResult,
) {
  const history = result.sandbox_history;
  const record = history.record;
  return {
    historyId: record.history_id,
    sandboxId: record.spec.sandbox_id,
    runtimeGroupId: record.spec.runtime_group_id,
    type: record.spec.workload_type,
    state: record.status.observed_state || record.status.desired_state,
    reason: record.reason,
    failure: record.status.failure_reason ?? "",
    archivedAt: record.archived_at,
    expiresAt: record.expires_at,
    logs: (history.logs ?? []).map((log) => ({
      name: log.name,
      size: log.size,
      truncated: log.truncated,
      content: log.content,
    })),
  };
}

export function sandboxDetailModel(result: SandboxInspectResult) {
  const sandbox = result.sandbox;
  const resources = sandbox.status.resources ?? {};
  return {
    sandboxId: sandbox.spec.sandbox_id,
    type: sandbox.spec.workload_type,
    state: sandbox.status.observed_state || sandbox.status.desired_state,
    reason: result.reason,
    runtimeGroupId: sandbox.spec.runtime_group_id,
    groupKey: sandbox.spec.placement_group ?? sandbox.spec.group_key,
    workers: sandbox.status.worker_count,
    failure: sandbox.status.failure_reason ?? "",
    memoryBytes: resources.memory_current ?? 0,
    cpuMicros: resources.cpu_usage_micros ?? 0,
    pids: resources.pid_current ?? 0,
    services: result.services.map((service) => ({
      navigation: `service:${service.service_id}`,
      serviceId: service.service_id,
      state: service.state,
      enabled: service.enabled,
      sandboxes: service.sandbox_count,
      workers: service.worker_count,
    })),
  };
}

export function formatDuration(nanoseconds: number): string {
  const units: Array<[number, string]> = [
    [3_600_000_000_000, "h"],
    [60_000_000_000, "m"],
    [1_000_000_000, "s"],
    [1_000_000, "ms"],
    [1_000, "us"],
  ];
  for (const [size, suffix] of units) {
    if (nanoseconds !== 0 && nanoseconds % size === 0) {
      return `${nanoseconds / size}${suffix}`;
    }
  }
  return `${nanoseconds}ns`;
}
