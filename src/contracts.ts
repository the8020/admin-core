export interface ServiceSummary {
  service_id: string;
  description?: string;
  canonical_base_path: string;
  state: string;
  enabled: boolean;
  instance_count: number;
  worker_count: number;
  execution_mode: string;
  access_mode: string;
  validation_error?: string;
}

export interface ServiceListResult extends Record<string, unknown> {
  services: ServiceSummary[];
}

export interface ServiceInstance {
  index: number;
  sandbox_id: string;
  worker_ids: string[] | null;
  active_requests: number;
  active_sessions: number;
}

export interface ServiceStatus {
  service_id: string;
  description?: string;
  canonical_base_path: string;
  execution_mode: string;
  access_mode: string;
  enabled: boolean;
  desired_generation: number;
  loaded_generation: number;
  state: string;
  instance_count: number;
  worker_count: number;
  instances: ServiceInstance[];
  effective_configuration: {
    instances: { minimum: number; desired: number; maximum: number };
    workers: {
      minimum: number;
      desired: number;
      maximum: number;
      max_in_flight: number;
    };
    timeouts: { request: number; drain: number; idle: number };
    dependency_mode: "cached-only" | "online";
    group_key: string;
  };
  validation_error?: string;
  last_startup_error?: string;
}

export interface ServiceInspectResult extends Record<string, unknown> {
  service: ServiceStatus;
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

export interface SandboxInspection {
  spec: {
    sandbox_id: string;
    runtime_group_id: string;
    workload_type: string;
    group_key: string;
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
  instance_count: number;
  worker_count: number;
}

export interface SandboxSession {
  session_id: string;
  type: string;
  user?: string;
  service_id?: string;
  state: string;
  worker_id?: string;
  current_program?: string;
}

export interface SandboxInspectResult extends Record<string, unknown> {
  sandbox: SandboxInspection;
  reason: string;
  services: SandboxService[];
  sessions: SandboxSession[];
}
