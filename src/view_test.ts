import { assertEquals } from "@std/assert";
import { validateLayout } from "@packages/the8020/uui/mod.ts";
import packageDetailLayout from "./layouts/package-detail.json" with {
  type: "json",
};
import type {
  PackageInspectResult,
  PackageListResult,
  PackageRepositoryInspectResult,
  SandboxHistoryInspectResult,
  SandboxHistoryListResult,
  SandboxInspectResult,
  ServiceInspectResult,
} from "./contracts.ts";
import { desiredVersion, sourceVersionOptions } from "./package-management.ts";
import {
  formatDuration,
  packageDetailModel,
  packageRows,
  sandboxDetailModel,
  sandboxHistoryDetailModel,
  sandboxHistoryRows,
  serviceDetailModel,
} from "./view.ts";

Deno.test("package detail groups cards under Overview and Contents", () => {
  const layout = validateLayout(packageDetailLayout);
  const sections = layout.root.children ?? [];
  assertEquals(sections.map((section) => section.title), [
    "Overview",
    "Contents",
  ]);
  assertEquals(sections[1]?.children?.[0]?.type, "stack");
  assertEquals(
    sections[1]?.children?.[0]?.children?.map((card) => card.title),
    ["Services", "Programs", "Files"],
  );
});

Deno.test("package list stays summary-only and detail maps selected contents", () => {
  const list: PackageListResult = {
    packages: [{
      package_id: "the8020/admin-core",
      description: "Administration programs",
      valid: true,
      service_count: 0,
    }],
  };
  assertEquals(packageRows(list), [{
    canonicalName: "the8020/admin-core",
    valid: true,
    services: 0,
    description: "Administration programs",
  }]);
  assertEquals(packageRows({ packages: null }), []);

  const inspection: PackageInspectResult = {
    package: {
      package_id: "the8020/admin-core",
      path: "/workspace/packages/the8020/admin-core",
      description: "Administration programs",
      documentation_url: "https://example.test/admin",
      license: "Apache-2.0",
      valid: true,
      service_count: 1,
      services: [{
        service_id: "the8020/admin-core/api",
        path: "services/api",
        description: "Admin API",
        execution_mode: "stateless",
        access_mode: "authenticated",
        entrypoint: "services/api/service.ts",
        valid: true,
      }],
      programs: [{
        program_id: "the8020/admin-core/packages",
        path: "programs/packages",
        description: "Packages",
        entrypoint: "program.ts",
        discoverable: true,
        valid: true,
      }],
      files: [{ path: "package.toml", type: "file", size: 80 }],
    },
  };
  const repository: PackageRepositoryInspectResult = {
    repository: {
      package_id: "the8020/admin-core",
      path: "/workspace/packages/the8020/admin-core",
      activation_ready: true,
      branch: "main",
      head: "0123456789abcdef",
      remote_name: "origin",
      remote_url: "ssh://git.example.test/the8020/admin-core.git",
      clean: true,
      status: "ready",
    },
  };
  const model = packageDetailModel(inspection, repository);
  assertEquals(model.packageId, "the8020/admin-core");
  assertEquals(model.programCount, 1);
  assertEquals(model.fileCount, 1);
  assertEquals(model.services[0]?.navigation, "service:the8020/admin-core/api");
  assertEquals(
    model.remoteUrl,
    "ssh://git.example.test/the8020/admin-core.git",
  );
});

Deno.test("package source references become explicit version selectors", () => {
  assertEquals(desiredVersion("latest"), {});
  assertEquals(desiredVersion("tag:v1.2.3"), { tag: "v1.2.3" });
  assertEquals(desiredVersion("commit:abcdef123456"), {
    commit: "abcdef123456",
  });
  assertEquals(
    sourceVersionOptions({
      source: "https://github.com/the8020/uui.git",
      author: "the8020",
      repository: "uui",
      package_id: "the8020/uui",
      default_branch: "main",
      references: [
        { kind: "branch", name: "main", commit: "abcdef123456" },
        { kind: "branch", name: "stable", commit: "abcdef123456" },
        { kind: "tag", name: "v1.0.0", commit: "123456abcdef" },
      ],
    }),
    [
      { value: "latest", label: "Latest default branch" },
      { value: "commit:abcdef123456", label: "main (abcdef123456)" },
      { value: "tag:v1.0.0", label: "Tag v1.0.0" },
    ],
  );
});

Deno.test("service detail maps editable configuration and sandbox links", () => {
  const result: ServiceInspectResult = {
    service: {
      service_id: "core/example/service",
      canonical_base_path: "/core/example/service",
      execution_mode: "stateless",
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
        active_executions: 0,
      }],
      effective_configuration: {
        execution: {
          mode: "stateless",
          concurrency_per_worker: 32,
          keep_alive: 120_000_000_000,
        },
        scaling: {
          replicas_min: 1,
          replicas_max: 2,
          workers_per_replica_min: 1,
          workers_per_replica_max: 4,
          target_utilization: 0.7,
        },
        placement: { sandbox_group: "core" },
      },
    },
  };
  const model = serviceDetailModel(result);
  assertEquals(model.keepAlive, "2m");
  assertEquals(model.concurrencyPerWorker, 32);
  assertEquals(model.targetUtilization, 70);
  assertEquals(model.sandboxes[0]?.navigation, "sandbox:sandbox-1");
});

Deno.test("service detail accepts a ready instance with no reported Worker IDs", () => {
  const result: ServiceInspectResult = {
    service: {
      service_id: "example/realtime/channel",
      canonical_base_path: "/example/realtime/channel",
      execution_mode: "persistent",
      access_mode: "authenticated",
      enabled: true,
      desired_generation: 1,
      loaded_generation: 1,
      state: "READY",
      instance_count: 1,
      worker_count: 0,
      instances: [{
        index: 0,
        sandbox_id: "sandbox-channel",
        worker_ids: null,
        active_requests: 0,
        active_executions: 0,
      }],
      effective_configuration: {
        execution: {
          mode: "persistent",
          concurrency_per_worker: 1,
          keep_alive: 120_000_000_000,
        },
        scaling: {
          replicas_min: 1,
          replicas_max: 1,
          workers_per_replica_min: 1,
          workers_per_replica_max: 10,
          target_utilization: 0.7,
        },
        placement: { sandbox_group: "realtime" },
      },
    },
  };
  const model = serviceDetailModel(result);
  assertEquals(model.sandboxes[0]?.workers, 0);
});

Deno.test("sandbox detail maps service links without service-owned sessions", () => {
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
  };
  const model = sandboxDetailModel(result);
  assertEquals(model.services[0]?.navigation, "service:core/example/service");
  assertEquals("sessions" in model, false);
});

Deno.test("sandbox history maps separately from live sandbox rows", () => {
  const list: SandboxHistoryListResult = {
    sandboxes: [{
      history_id: "20260827T130405.123456789Z-sbx-ax9thsl3",
      sandbox_id: "sbx-ax9thsl3",
      runtime_group_id: "group-1",
      workload_type: "service",
      state: "FAILED",
      reason: "supervisor heartbeat exceeded 15s",
      archived_at: "2026-08-27T13:04:05Z",
      expires_at: "2026-09-03T13:04:05Z",
      log_files: 2,
      log_bytes: 120,
    }],
    next_cursor: "",
  };
  assertEquals(sandboxHistoryRows(list)[0]?.sandboxId, "sbx-ax9thsl3");
  assertEquals(sandboxHistoryRows({ sandboxes: null, next_cursor: "" }), []);

  const detail: SandboxHistoryInspectResult = {
    sandbox_history: {
      record: {
        history_id: "20260827T130405.123456789Z-sbx-ax9thsl3",
        archived_at: "2026-08-27T13:04:05Z",
        expires_at: "2026-09-03T13:04:05Z",
        reason: "supervisor heartbeat exceeded 15s",
        spec: {
          sandbox_id: "sbx-ax9thsl3",
          runtime_group_id: "group-1",
          workload_type: "service",
          group_key: "service:example",
          lifecycle: { warm: false },
        },
        status: {
          desired_state: "FAILED",
          observed_state: "FAILED",
          worker_count: 0,
          failure_reason: "supervisor heartbeat exceeded 15s",
        },
      },
      logs: [{
        name: "runtime.log",
        size: 4,
        content: "test",
        truncated: false,
      }],
    },
  };
  const model = sandboxHistoryDetailModel(detail);
  assertEquals(model.historyId, list.sandboxes?.[0]?.history_id);
  assertEquals(model.logs[0]?.content, "test");
});

Deno.test("duration rendering uses exact Go duration units", () => {
  assertEquals(formatDuration(3_600_000_000_000), "1h");
  assertEquals(formatDuration(250_000_000), "250ms");
  assertEquals(formatDuration(17), "17ns");
});
