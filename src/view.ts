import type {
  SandboxInspectResult,
  SandboxListResult,
  ServiceInspectResult,
  ServiceListResult,
} from "./contracts.ts";

export function serviceRows(result: ServiceListResult) {
  return result.services.map((service) => ({
    serviceId: service.service_id,
    state: service.state,
    enabled: service.enabled,
    instances: service.instance_count,
    workers: service.worker_count,
    mode: service.execution_mode,
    description: service.description ?? service.validation_error ?? "",
  }));
}

export function serviceDetailModel(result: ServiceInspectResult) {
  const service = result.service;
  const configuration = service.effective_configuration;
  return {
    serviceId: service.service_id,
    description: service.description ?? "",
    path: service.canonical_base_path,
    state: service.state,
    enabled: service.enabled,
    executionMode: service.execution_mode,
    accessMode: service.access_mode,
    desiredGeneration: service.desired_generation,
    loadedGeneration: service.loaded_generation,
    instancesMinimum: configuration.instances.minimum,
    instancesDesired: configuration.instances.desired,
    instancesMaximum: configuration.instances.maximum,
    workersMinimum: configuration.workers.minimum,
    workersDesired: configuration.workers.desired,
    workersMaximum: configuration.workers.maximum,
    maxInFlight: configuration.workers.max_in_flight,
    requestTimeout: formatDuration(configuration.timeouts.request),
    drainTimeout: formatDuration(configuration.timeouts.drain),
    idleTimeout: formatDuration(configuration.timeouts.idle),
    dependencyMode: configuration.dependency_mode,
    groupKey: configuration.group_key,
    failure: service.validation_error ?? service.last_startup_error ?? "",
    sandboxes: service.instances.map((instance) => ({
      navigation: `sandbox:${instance.sandbox_id}`,
      sandboxId: instance.sandbox_id,
      state: service.state,
      workers: instance.worker_ids?.length ?? 0,
      activeRequests: instance.active_requests,
      activeSessions: instance.active_sessions,
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

export function sandboxDetailModel(result: SandboxInspectResult) {
  const sandbox = result.sandbox;
  const resources = sandbox.status.resources ?? {};
  return {
    sandboxId: sandbox.spec.sandbox_id,
    type: sandbox.spec.workload_type,
    state: sandbox.status.observed_state || sandbox.status.desired_state,
    reason: result.reason,
    runtimeGroupId: sandbox.spec.runtime_group_id,
    groupKey: sandbox.spec.group_key,
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
      instances: service.instance_count,
      workers: service.worker_count,
    })),
    sessions: result.sessions.map((session) => ({
      sessionId: session.session_id,
      type: session.type,
      user: session.user ?? "",
      serviceId: session.service_id ?? "",
      state: session.state,
      workerId: session.worker_id ?? "",
      program: session.current_program ?? "",
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
