import { sourceVersionOptions } from "/p/the8020/packages/types/source.ts";
import { assertEquals } from "@std/assert";
import type { PackageRepository } from "@the8020/kernel";
import { validateLayout } from "/p/the8020/uui/mod.ts";
import packageDetailLayout from "./layouts/package-detail.json" with {
  type: "json",
};
import packageAdvancedLayout from "./layouts/package-advanced.json" with {
  type: "json",
};
import serviceSettingsLayout from "./layouts/service-settings.json" with {
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
} from "./package-management.ts";
import {
  formatDuration,
  packageDetailModel,
  packageRows,
  sandboxDetailModel,
  sandboxHistoryDetailModel,
  sandboxHistoryRows,
  serviceDetailModel,
  serviceRows,
} from "./view.ts";

Deno.test("package overview links content while Advanced retains full inspection cards", () => {
  assertEquals(
    validateLayout(packageDetailLayout).root.children?.map((card) => card.id),
    ["overview", "services", "programs"],
  );
  const layout = validateLayout(packageAdvancedLayout);
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

Deno.test("service configuration keeps all policy in one page with the original scaling groups", () => {
  const overview = validateLayout(serviceDetailLayout);
  assertEquals(
    overview.root.children?.[0]?.controls?.includes("enabled"),
    true,
  );
  assertEquals(JSON.stringify(overview).includes("minimumWorkers"), false);
  const settings = validateLayout(serviceSettingsLayout);
  const groups = settings.root.children!;
  assertEquals(groups.map((group) => group.id), [
    "service-state",
    "scaling-section",
    "lifecycle-section",
  ]);
  assertEquals(groups[0]?.controls, ["enabled"]);
  assertEquals(
    groups[1]?.children?.[0]?.children?.map((group) => ({
      title: group.title,
      controls: group.controls,
    })),
    [
      {
        title: "Worker threads",
        controls: ["minimumWorkers", "maximumWorkers"],
      },
      {
        title: "Single worker",
        controls: [
          "concurrencyPerWorker",
          "targetUtilization",
          "workerKeepAlive",
        ],
      },
      {
        title: "Replication",
        controls: ["sandboxGroup", "minimumSandboxes", "workersPerSandbox"],
      },
    ],
  );
  assertEquals(groups[2]?.children?.[0]?.controls, [
    "anonymousUser",
    "serviceType",
    "sessionKeepAlive",
  ]);
});

Deno.test("service list keeps one aggregate row with version and unique capacity counts", () => {
  assertEquals(
    serviceRows({
      services: [{
        service_id: "the8020/uui/session",
        package_id: "the8020/uui",
        source_entrypoint:
          "file:///workspace/packages/the8020/uui/services/session/service.ts",
        canonical_base_path: "/the8020/uui/session",
        state: "READY",
        enabled: true,
        version_count: 2,
        sandbox_count: 1,
        worker_count: 3,
        service_type: "session",
        access_mode: "authenticated",
      }],
    }),
    [{
      serviceId: "the8020/uui/session",
      state: "READY",
      enabled: true,
      versions: 2,
      sandboxes: 1,
      workers: 3,
      serviceType: "session",
      description: "",
    }],
  );
});

Deno.test("package screens join generic package records with their indexed services", () => {
  const service = {
    service_id: "the8020/admin-core/api",
    package_id: "the8020/admin-core",
    canonical_base_path: "/the8020/admin-core/api",
    source_entrypoint:
      "file:///workspace/packages/the8020/admin-core/services/api/service.ts",
    description: "Admin API",
    service_type: "stateless",
    access_mode: "authenticated",
    state: "IDLE",
    enabled: true,
    version_count: 0,
    sandbox_count: 0,
    worker_count: 0,
  };
  const list: PackageListResult = {
    packages: [{
      package_id: "the8020/admin-core",
      description: "Administration programs",
      valid: true,
    }],
    services: [service, {
      ...service,
      service_id: "other/package/api",
      package_id: "other/package",
    }],
  };
  assertEquals(packageRows(list), [{
    canonicalName: "the8020/admin-core",
    valid: true,
    services: 1,
    description: "Administration programs",
  }]);
  assertEquals(packageRows({ packages: null, services: [] }), []);

  const inspection: PackageInspectResult = {
    package: {
      package_id: "the8020/admin-core",
      path: "/workspace/packages/the8020/admin-core",
      description: "Administration programs",
      documentation_url: "https://example.test/admin",
      license: "Apache-2.0",
      valid: true,
      programs: [{
        program_id: "the8020/admin-core/packages",
        path: "programs/packages",
        description: "Packages",
        entrypoint: "program.ts",
        discoverable: true,
        uui: true,
        valid: true,
      }],
      files: [{ path: "package.toml", type: "file", size: 80 }],
    },
    services: list.services,
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
  assertEquals(model.serviceCount, 1);
  assertEquals(model.services[0]?.entrypoint, service.source_entrypoint);
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
      desired_version: 4,
      loaded_version: 4,
      version_count: 1,
      state: "READY",
      sandbox_count: 1,
      worker_count: 2,
      sandboxes: [{
        index: 0,
        version: 4,
        sandbox_id: "sandbox-1",
        worker_ids: ["worker-1", "worker-2"],
        active_requests: 1,
        active_executions: 0,
      }],
      effective_configuration: {
        execution: { anonymous_user: "visitor" },
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
  assertEquals(model.anonymousUser, "visitor");
  assertEquals(model.sessionKeepAlive, "10m");
  assertEquals(model.concurrencyPerWorker, 32);
  assertEquals(model.targetUtilization, 70.5);
  assertEquals(model.sandboxes[0]?.navigation, "sandbox:sandbox-1");
  assertEquals(model.sandboxes[0]?.version, 4);
});

Deno.test("service detail opens for a service that owns no sandboxes", () => {
  const result: ServiceInspectResult = {
    service: {
      service_id: "thomolka/hello-world/hello",
      canonical_base_path: "/thomolka/hello-world/hello",
      service_type: "stateless",
      access_mode: "public",
      enabled: true,
      desired_version: 1,
      loaded_version: 1,
      version_count: 1,
      state: "DISABLED",
      sandbox_count: 0,
      worker_count: 0,
      // A disabled or failed service reports the collection as null.
      sandboxes: null,
      effective_configuration: {
        execution: { anonymous_user: "system" },
        lifecycle: {
          service_type: "stateless",
          session_keep_alive: 600_000_000_000,
        },
        scaling: {
          minimum_workers: 0,
          maximum_workers: 0,
          concurrency_per_worker: 32,
          target_utilization: 0.7,
          worker_keep_alive: 120_000_000_000,
        },
        placement: {
          sandbox_group: "",
          minimum_sandboxes: 0,
          workers_per_sandbox: 4,
        },
      },
    },
  };
  const model = serviceDetailModel(result);
  assertEquals(model.sandboxes, []);
  assertEquals(model.state, "DISABLED");
});

Deno.test("service detail accepts a ready sandbox with no reported Worker IDs", () => {
  const result: ServiceInspectResult = {
    service: {
      service_id: "example/realtime/channel",
      canonical_base_path: "/example/realtime/channel",
      service_type: "session",
      access_mode: "authenticated",
      enabled: true,
      desired_version: 1,
      loaded_version: 1,
      version_count: 1,
      state: "READY",
      sandbox_count: 1,
      worker_count: 0,
      sandboxes: [{
        index: 0,
        version: 1,
        sandbox_id: "sandbox-channel",
        worker_ids: null,
        active_requests: 0,
        active_executions: 0,
      }],
      effective_configuration: {
        execution: { anonymous_user: "system" },
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

        workload_type: "service",
        group_key: "service:core/example/service",
        lifecycle: { warm: false },
      },
      status: {
        desired_state: "READY",
        observed_state: "READY",
        node_id: "nod-abcdefghij",
        created_at: "2026-08-27T13:00:00Z",
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

      workload_type: "service",
      state: "FAILED",
      reason: "supervisor heartbeat exceeded 15s",
      archived_at: "2026-08-27T13:04:05Z",
      expires_at: "2026-09-03T13:04:05Z",
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

          workload_type: "service",
          group_key: "service:example",
          lifecycle: { warm: false },
        },
        status: {
          desired_state: "FAILED",
          observed_state: "FAILED",
          node_id: "nod-abcdefghij",
          created_at: "2026-08-27T13:00:00Z",
          log_position: "saved-log-position",
          worker_count: 0,
          failure_reason: "supervisor heartbeat exceeded 15s",
        },
      },
    },
  };
  const model = sandboxHistoryDetailModel(detail, {
    state: "ok",
    more: false,
    scanned_bytes: 200,
    records: [{
      time: "2026-08-27T13:01:00Z",
      level: "ERROR",
      source: "deno",
      component: "worker",
      node_id: "nod-abcdefghij",
      sandbox_id: "sbx-ax9thsl300",
      message: "Error: test\n    at program.ts:1",
      segment: "segment",
      offset: 0,
    }],
  });
  assertEquals(model.historyId, list.sandboxes?.[0]?.history_id);
  assertEquals(model.nodeId, "nod-abcdefghij");
  assertEquals(model.logs.includes("Error: test\n    at program.ts:1"), true);
  for (const state of ["expired", "unavailable"] as const) {
    const unavailable = sandboxHistoryDetailModel(detail, {
      state,
      records: [],
      more: false,
      scanned_bytes: 0,
    });
    assertEquals(unavailable.failure, "supervisor heartbeat exceeded 15s");
    assertEquals(unavailable.logStatus.includes(state), true);
    assertEquals(unavailable.logs, "");
  }
});

Deno.test("duration rendering uses exact Go duration units", () => {
  assertEquals(formatDuration(3_600_000_000_000), "1h");
  assertEquals(formatDuration(250_000_000), "250ms");
  assertEquals(formatDuration(17), "17ns");
});
