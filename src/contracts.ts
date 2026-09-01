export interface ServiceSummary {
  service_id: string;
  description?: string;
  canonical_base_path: string;
  state: string;
  enabled: boolean;
  version_count: number;
  sandbox_count: number;
  worker_count: number;
  service_type: string;
  access_mode: string;
  validation_error?: string;
}

export interface ServiceListResult extends Record<string, unknown> {
  services: ServiceSummary[];
}

export interface ServiceSandbox {
  index: number;
  version: number;
  sandbox_id: string;
  worker_ids: string[] | null;
  active_requests: number;
  active_executions: number;
}

export interface ServiceStatus {
  service_id: string;
  description?: string;
  canonical_base_path: string;
  service_type: "stateless" | "session";
  access_mode: string;
  enabled: boolean;
  desired_version: number;
  loaded_version: number;
  version_count: number;
  state: string;
  sandbox_count: number;
  worker_count: number;
  sandboxes: ServiceSandbox[];
  effective_configuration: {
    lifecycle: {
      service_type: "stateless" | "session";
      session_keep_alive: number;
    };
    scaling: {
      minimum_workers: number;
      maximum_workers: number;
      concurrency_per_worker: number;
      target_utilization: number;
      worker_keep_alive: number;
    };
    placement: {
      sandbox_group: string;
      minimum_sandboxes: number;
      workers_per_sandbox: number;
    };
  };
  validation_error?: string;
  last_startup_error?: string;
  capacity_resource?: string;
  capacity_reason?: string;
}

export interface ServiceInspectResult extends Record<string, unknown> {
  service: ServiceStatus;
}

export interface PackageSummary {
  package_id: string;
  description?: string;
  valid: boolean;
  service_count: number;
  validation_error?: string;
}

export interface PackageListResult extends Record<string, unknown> {
  packages: PackageSummary[] | null;
}

export interface PackageService {
  service_id: string;
  path: string;
  description?: string;
  service_type?: string;
  access_mode?: string;
  entrypoint?: string;
  valid: boolean;
  validation_errors?: string[] | null;
}

export interface PackageProgram {
  program_id: string;
  path: string;
  description?: string;
  entrypoint?: string;
  default_layout?: string;
  discoverable: boolean;
  valid: boolean;
  validation_errors?: string[] | null;
}

export interface PackageFile {
  path: string;
  type: string;
  size: number;
}

export interface PackageInspection {
  package_id: string;
  path: string;
  description?: string;
  documentation_url?: string;
  license?: string;
  valid: boolean;
  service_count: number;
  services?: PackageService[] | null;
  programs?: PackageProgram[] | null;
  files?: PackageFile[] | null;
  contents_truncated?: boolean;
  validation_errors?: string[] | null;
  inspection_errors?: string[] | null;
}

export interface PackageInspectResult extends Record<string, unknown> {
  package: PackageInspection;
}

export interface SandboxSummary {
  sandbox_id: string;
  runtime_group_id: string;
  workload_type: string;
  state: string;
  worker_count: number;
  warm: boolean;
  reason: string;
  failure?: string;
}

export interface SandboxListResult extends Record<string, unknown> {
  sandboxes: SandboxSummary[];
}

export interface SandboxHistorySummary {
  history_id: string;
  sandbox_id: string;
  runtime_group_id: string;
  workload_type: string;
  state: string;
  reason?: string;
  failure_reason?: string;
  archived_at: string;
  expires_at: string;
  log_files: number;
  log_bytes: number;
}

export interface SandboxHistoryListResult extends Record<string, unknown> {
  sandboxes: SandboxHistorySummary[] | null;
  next_cursor: string;
}

export interface SandboxInspection {
  spec: {
    sandbox_id: string;
    runtime_group_id: string;
    workload_type: string;
    group_key: string;
    placement_group?: string;
    lifecycle: { warm: boolean };
  };
  status: {
    desired_state: string;
    observed_state: string;
    failure_reason?: string;
    worker_count: number;
    resources?: {
      cpu_usage_micros?: number;
      memory_current?: number;
      pid_current?: number;
    };
  };
  workers: Array<{
    worker_id: string;
    owner_id: string;
    state: string;
    in_flight: number;
  }>;
}

export interface SandboxService {
  service_id: string;
  state: string;
  enabled: boolean;
  sandbox_count: number;
  worker_count: number;
}

export interface SandboxInspectResult extends Record<string, unknown> {
  sandbox: SandboxInspection;
  reason: string;
  services: SandboxService[];
}

export interface SandboxHistoryInspectResult extends Record<string, unknown> {
  sandbox_history: {
    record: {
      history_id: string;
      archived_at: string;
      expires_at: string;
      reason: string;
      spec: SandboxInspection["spec"];
      status: SandboxInspection["status"];
    };
    logs:
      | Array<{
        name: string;
        size: number;
        content: string;
        truncated: boolean;
      }>
      | null;
  };
}
