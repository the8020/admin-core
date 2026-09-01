import { assertEquals } from "@std/assert";
import type { PackageRepository } from "@the8020/kernel";
import { validateLayout } from "@packages/the8020/uui/mod.ts";
import packageDetailLayout from "./layouts/package-detail.json" with {
  type: "json",
};
import serviceDetailLayout from "./layouts/service-detail.json" with {
  type: "json",
};
import type {
  PackageInspectResult,
  PackageListResult,
  SandboxHistoryInspectResult,
  SandboxHistoryListResult,
  SandboxInspectResult,
  ServiceInspectResult,
} from "./contracts.ts";
import {
  desiredVersion,
  installSchema,
  LocalPackage,
  requiredText,
  sourceVersionOptions,
} from "./package-management.ts";
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

Deno.test("service detail presents canonical scaling and lifecycle groups", () => {
  const layout = validateLayout(serviceDetailLayout);
  const sections = layout.root.children ?? [];
  assertEquals(sections.map((section) => section.title), [
    "Status",
    "Scaling",
    "Lifecycle",
    "Sandboxes",
  ]);
  assertEquals(
    sections[1]?.children?.[0]?.children?.map((group) => group.title),
    ["Worker threads", "Single worker", "Replication"],
  );
  const encoded = JSON.stringify(layout);
  assertEquals(
    /\b(?:replica|replicas|instance|instances)\b/i.test(encoded),
    false,
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
        service_type: "stateless",
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
  const repository: PackageRepository = {
    package_id: "the8020/admin-core",
    path: "/workspace/packages/the8020/admin-core",
    activation_ready: true,
    branch: "main",
    head: "0123456789abcdef",
    remote_name: "origin",
    remote_url: "ssh://git.example.test/the8020/admin-core.git",
    clean: true,
    status: "ready",
    branches: [{
      name: "main",
      commit: "0123456789abcdef",
      current: true,
      remote: false,
    }],
    commits: [{
      commit: "0123456789abcdef",
      short_commit: "0123456",
      authored_at: "2026-09-01T00:00:00Z",
      author: "Developer",
      subject: "Current",
      current: true,
    }],
  };
  const model = packageDetailModel(inspection, repository, "github");
  assertEquals(model.packageId, "the8020/admin-core");
  assertEquals(model.programCount, 1);
  assertEquals(model.fileCount, 1);
  assertEquals(model.secretName, "github");
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

Deno.test("blank package forms render before required values are entered", () => {
  assertEquals(
    installSchema().safeParse({
      source: "",
      author: "",
      repository: "",
      defaultBranch: "",
      version: "latest",
      references: [],
    }).success,
    true,
  );
  assertEquals(
    LocalPackage.safeParse({ author: "", repository: "", description: "" })
      .success,
    true,
  );
  assertEquals(requiredText("  the8020 ", "Author"), "the8020");
  let message = "";
  try {
    requiredText("  ", "Git URL");
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  assertEquals(message, "Git URL is required");
});

Deno.test("service detail maps editable configuration and sandbox links", () => {
  const result: ServiceInspectResult = {
    service: {
      service_id: "core/example/service",
      canonical_base_path: "/core/example/service",
      service_type: "stateless",
      access_mode: "public",
      enabled: true,
      desired_generation: 4,
      loaded_generation: 4,
      state: "READY",
      sandbox_count: 1,
      worker_count: 2,
      sandboxes: [{
        index: 0,
        sandbox_id: "sandbox-1",
        worker_ids: ["worker-1", "worker-2"],
        active_requests: 1,
        active_executions: 0,
      }],
      effective_configuration: {
        lifecycle: {
          service_type: "stateless",
          session_keep_alive: 600_000_000_000,
        },
        scaling: {
          minimum_workers: 1,
          maximum_workers: 8,
          concurrency_per_worker: 32,
          target_utilization: 0.705,
          worker_keep_alive: 120_000_000_000,
        },
        placement: {
          sandbox_group: "core",
          minimum_sandboxes: 1,
          workers_per_sandbox: 4,
        },
      },
    },
  };
  const model = serviceDetailModel(result);
  assertEquals(model.workerKeepAlive, "2m");
  assertEquals(model.sessionKeepAlive, "10m");
  assertEquals(model.concurrencyPerWorker, 32);
  assertEquals(model.targetUtilization, 70.5);
  assertEquals(model.sandboxes[0]?.navigation, "sandbox:sandbox-1");
});

Deno.test("service detail accepts a ready sandbox with no reported Worker IDs", () => {
  const result: ServiceInspectResult = {
    service: {
      service_id: "example/realtime/channel",
      canonical_base_path: "/example/realtime/channel",
      service_type: "session",
      access_mode: "authenticated",
      enabled: true,
      desired_generation: 1,
      loaded_generation: 1,
      state: "READY",
      sandbox_count: 1,
      worker_count: 0,
      sandboxes: [{
        index: 0,
        sandbox_id: "sandbox-channel",
        worker_ids: null,
        active_requests: 0,
        active_executions: 0,
      }],
      effective_configuration: {
        lifecycle: {
          service_type: "session",
          session_keep_alive: 120_000_000_000,
        },
        scaling: {
          minimum_workers: 1,
          maximum_workers: 10,
          concurrency_per_worker: 1,
          target_utilization: 0.7,
          worker_keep_alive: 120_000_000_000,
        },
        placement: {
          sandbox_group: "realtime",
          minimum_sandboxes: 1,
          workers_per_sandbox: 10,
        },
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
      sandbox_count: 1,
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
