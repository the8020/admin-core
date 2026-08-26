import { assertEquals } from "@std/assert";
import type {
  SandboxInspectResult,
  ServiceInspectResult,
} from "./contracts.ts";
import {
  formatDuration,
  sandboxDetailModel,
  serviceDetailModel,
} from "./view.ts";

Deno.test("service detail maps editable configuration and sandbox links", () => {
  const result: ServiceInspectResult = {
    service: {
      service_id: "core/example/service",
      canonical_base_path: "/core/example/service",
      execution_mode: "request",
      access_mode: "public",
      enabled: true,
      desired_generation: 4,
      loaded_generation: 4,
      state: "READY",
      instance_count: 1,
      worker_count: 2,
      instances: [{
        index: 0,
        sandbox_id: "sandbox-1",
        worker_ids: ["worker-1", "worker-2"],
        active_requests: 1,
        active_sessions: 0,
      }],
      effective_configuration: {
        instances: { minimum: 1, desired: 1, maximum: 2 },
        workers: { minimum: 1, desired: 2, maximum: 4, max_in_flight: 32 },
        timeouts: {
          request: 30_000_000_000,
          drain: 60_000_000_000,
          idle: 0,
        },
        dependency_mode: "cached-only",
        group_key: "core/example/service",
      },
    },
  };
  const model = serviceDetailModel(result);
  assertEquals(model.requestTimeout, "30s");
  assertEquals(model.drainTimeout, "1m");
  assertEquals(model.idleTimeout, "0ns");
  assertEquals(model.sandboxes[0]?.navigation, "sandbox:sandbox-1");
});

Deno.test("service detail accepts a ready instance with no reported Worker IDs", () => {
  const result: ServiceInspectResult = {
    service: {
      service_id: "example/core-ui/session",
      canonical_base_path: "/example/core-ui/session",
      execution_mode: "session",
      access_mode: "authenticated",
      enabled: true,
      desired_generation: 1,
      loaded_generation: 1,
      state: "READY",
      instance_count: 1,
      worker_count: 0,
      instances: [{
        index: 0,
        sandbox_id: "sandbox-session",
        worker_ids: null,
        active_requests: 0,
        active_sessions: 0,
      }],
      effective_configuration: {
        instances: { minimum: 1, desired: 1, maximum: 1 },
        workers: { minimum: 0, desired: 0, maximum: 10, max_in_flight: 1 },
        timeouts: { request: 0, drain: 0, idle: 0 },
        dependency_mode: "cached-only",
        group_key: "example/core-ui/session",
      },
    },
  };
  assertEquals(serviceDetailModel(result).sandboxes[0]?.workers, 0);
});

Deno.test("sandbox detail maps service links and sessions", () => {
  const result: SandboxInspectResult = {
    reason: "core/example/service",
    sandbox: {
      spec: {
        sandbox_id: "sandbox-1",
        runtime_group_id: "group-1",
        workload_type: "service",
        group_key: "service:core/example/service",
        lifecycle: { warm: false },
      },
      status: {
        desired_state: "READY",
        observed_state: "READY",
        worker_count: 2,
      },
      workers: [],
    },
    services: [{
      service_id: "core/example/service",
      state: "READY",
      enabled: true,
      instance_count: 1,
      worker_count: 2,
    }],
    sessions: [{
      session_id: "session-1",
      type: "uui",
      user: "Admin",
      service_id: "example/core-ui/session",
      state: "CONNECTED",
    }],
  };
  const model = sandboxDetailModel(result);
  assertEquals(model.services[0]?.navigation, "service:core/example/service");
  assertEquals(model.sessions[0]?.sessionId, "session-1");
});

Deno.test("duration rendering uses exact Go duration units", () => {
  assertEquals(formatDuration(3_600_000_000_000), "1h");
  assertEquals(formatDuration(250_000_000), "250ms");
  assertEquals(formatDuration(17), "17ns");
});
