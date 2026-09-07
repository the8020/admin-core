import { ScreenFrame } from "./screen_frame.ts";
import { kernel } from "@the8020/kernel";
import {
  BACK_EVENT,
  callScreen,
  field,
  Model,
  presentPage,
  sendMessage,
  z,
} from "/p/the8020/uui/mod.ts";
import { serviceId as serviceField } from "/p/the8020/services/types/service.ts";
import { packageId as packageField } from "/p/the8020/packages/types/package.ts";
import { username } from "/p/the8020/users/types/user.ts";
import { sandboxId as sandboxField } from "../types/runtime.ts";
import serviceSettingsLayout from "./layouts/service-settings.json" with {
  type: "json",
};
import serviceDetailLayout from "./layouts/service-detail.json" with {
  type: "json",
};
import serviceListLayout from "./layouts/service-list.json" with {
  type: "json",
};
import type {
  ServiceListResult,
  ServiceStatus,
  ServiceSummary,
} from "./contracts.ts";
import type { ScreenResult } from "./navigation.ts";
import { serviceDetailModel, serviceRows } from "./view.ts";

const ServiceRow = z.object({
  serviceId: serviceField,
  state: field(z.string(), { label: "Status" }),
  enabled: z.boolean(),
  versions: z.number().int(),
  sandboxes: z.number().int(),
  workers: z.number().int(),
  serviceType: z.string(),
  description: field(z.string(), { label: "Description" }),
});
const ServiceList = z.object({ services: z.array(ServiceRow) });

const SandboxRow = z.object({
  navigation: z.string(),
  sandboxId: sandboxField,
  version: z.number().int(),
  state: z.string(),
  workers: z.number().int(),
  activeRequests: z.number().int(),
  activeExecutions: z.number().int(),
  snapshotRevision: z.number().int().nonnegative(),
  snapshotObservedAt: z.string(),
});
function serviceDetailSchema(serviceType: string, editing = false) {
  return z.object({
    serviceId: field(serviceField, { readOnly: true, open: undefined }),
    packageId: field(packageField, { readOnly: true }),
    description: field(z.string(), { label: "Description", readOnly: true }),
    path: field(z.string(), { label: "Address", readOnly: true }),
    state: field(z.string(), { label: "Status", readOnly: true }),
    workerCount: field(z.number().int(), {
      label: "Running Workers",
      readOnly: true,
    }),
    sandboxCount: field(z.number().int(), {
      label: "Sandboxes",
      readOnly: true,
    }),
    versionCount: field(z.number().int(), {
      label: "Live versions",
      readOnly: true,
    }),
    enabled: field(z.boolean(), { label: "Enabled", readOnly: !editing }),
    accessMode: field(z.string(), { label: "Access", readOnly: true }),
    anonymousUser: field(username, {
      label: "Public execution user",
      description:
        "Runs unauthenticated requests with this identity. You can enter an identity directly or choose an account; account sign-in settings do not limit service execution.",
    }),
    desiredVersion: field(z.number().int(), {
      label: "Desired version",
      readOnly: true,
    }),
    loadedVersion: field(z.number().int(), {
      label: "Loaded version",
      readOnly: true,
    }),
    minimumWorkers: field(z.number().int().nonnegative(), {
      label: "Minimum Workers",
      description:
        "Keep this many Workers ready. **0** allows the service to stop idle Workers and start them when needed.",
    }),
    maximumWorkers: field(z.number().int().nonnegative(), {
      label: "Maximum Workers",
      description:
        "Limit the number of Workers this service may start. **0** means no service limit; available resources still limit capacity.",
    }),
    concurrencyPerWorker: field(z.number().int().positive(), {
      label: "Requests per Worker",
      description: "Maximum concurrent requests handled by one Worker.",
    }),
    targetUtilization: field(z.number().min(1).max(100), {
      label: "Target utilization",
      control: "range",
      minimum: 1,
      maximum: 100,
      step: 0.1,
      valueSuffix: "%",
    }),
    workerKeepAlive: field(z.string().min(1), {
      label: "Idle Worker timeout",
      description:
        "How long an excess idle Worker stays ready. Use a duration such as `30s`, `5m`, or `1h`.",
    }),
    sandboxGroup: field(z.string(), {
      label: "Sandbox group",
      description: "Only compatible services in the same group may share.",
    }),
    minimumSandboxes: field(z.number().int().nonnegative(), {
      label: "Minimum sandboxes",
      description: "Keeps warm compatible sandboxes even with zero Workers.",
    }),
    workersPerSandbox: field(z.number().int().positive(), {
      label: "Workers per sandbox",
      description: "Per-service packing limit in one sandbox.",
    }),
    serviceType: field(z.enum(["stateless", "session"]), {
      label: "Service type",
      reactive: true,
      description: "Session services retain a persistent session environment.",
    }),
    sessionKeepAlive: field(z.string().min(1), {
      label: "Idle session timeout",
      hidden: serviceType !== "session",
      description:
        "How long a session stays available after activity ends, for example `30m` or `2h`.",
    }),
    failure: field(z.string(), { label: "Attention", readOnly: true }),
    sandboxes: z.array(SandboxRow),
  });
}

export async function serviceList(
  frame = new ScreenFrame(),
): Promise<ScreenResult> {
  while (true) {
    const result = {
      services: await kernel.services.list<ServiceSummary>(),
    } as ServiceListResult;
    const model = { services: serviceRows(result) };
    const event = await callScreen({
      id: "core-admin-services",
      title: "Services",
      schema: ServiceList,
      model: frame.model(model),
      layout: serviceListLayout,
      header: {
        actions: [{ id: "refresh", label: "[[icon=refresh]] Refresh" }],
      },
    });
    if (event.action === BACK_EVENT) return { view: "back" };
    if (event.action === "refresh") continue;
    return event.action === "select" && typeof event.value === "string"
      ? { view: "service", serviceId: event.value }
      : { view: "back" };
  }
}

export async function serviceDetail(
  serviceId: string,
  frame = new ScreenFrame(),
): Promise<ScreenResult> {
  let service = await kernel.services.inspect<ServiceStatus>(serviceId);
  while (true) {
    const model = serviceDetailModel({ service });
    const controls = [
      "description",
      "state",
      "enabled",
      "path",
      "accessMode",
      "packageId",
      "workerCount",
      "sandboxCount",
      "failure",
    ];
    const event = await callScreen({
      id: "core-admin-service-detail",
      title: `Service ${serviceId.split("/").at(-1)}`,
      schema: serviceDetailSchema(model.serviceType),
      model: frame.model(model),
      controls: controls.map((bind) => ({
        bind,
        hidden: bind === "failure" && !model.failure,
      })),
      layout: {
        ...serviceDetailLayout,
        root: {
          ...serviceDetailLayout.root,
          children: serviceDetailLayout.root.children.filter((item) =>
            item.id !== "sandboxes" || model.sandboxes.length > 0
          ),
        },
      },
      actions: [{ id: "package", label: "Open package" }],
      header: {
        actions: [
          { id: "configure", label: "Configure", kind: "primary" },
          {
            id: model.enabled ? "disable" : "enable",
            label: model.enabled ? "Disable" : "Enable",
          },
          ...(model.enabled ? [{ id: "restart", label: "Restart" }] : []),
          { id: "advanced", label: "Advanced" },
          { id: "refresh", label: "[[icon=refresh]] Refresh" },
        ],
      },
    });
    if (event.action === BACK_EVENT) return { view: "back" };
    if (event.action === "configure") {
      return { view: "serviceSettings", serviceId };
    }
    if (event.action === "package") {
      return { view: "package", packageId: model.packageId };
    }
    if (
      event.action === "select" && typeof event.value === "string" &&
      event.value.startsWith("sandbox:")
    ) {
      return { view: "sandbox", sandboxId: event.value.slice(8) };
    }
    if (event.action === "advanced") {
      await presentPage(() =>
        callScreen({
          id: "core-admin-service-advanced",
          title: `Advanced · ${serviceId.split("/").at(-1)}`,
          schema: serviceDetailSchema(model.serviceType),
          model: new Model(model),
          controls: [
            "serviceId",
            "desiredVersion",
            "loadedVersion",
            "versionCount",
          ].map((bind) => ({ bind })),
          layout: {
            schema: 1,
            id: "service-advanced",
            root: {
              id: "service-advanced",
              type: "stack",
              children: [
                {
                  id: "versions",
                  type: "detail",
                  controls: [
                    "serviceId",
                    "desiredVersion",
                    "loadedVersion",
                    "versionCount",
                  ],
                },
                {
                  id: "sandboxes",
                  type: "list",
                  title: "Capacity by version",
                  bind: "sandboxes",
                  display: [
                    "sandboxId",
                    "version",
                    "workers",
                    "activeRequests",
                    "activeExecutions",
                    "snapshotRevision",
                    "snapshotObservedAt",
                  ],
                },
              ],
            },
          },
        })
      );
      continue;
    }
    try {
      if (["enable", "disable", "restart"].includes(event.action)) {
        const { applyDesired } = await import(
          "/p/the8020/services/src/admin.ts"
        );
        await applyDesired(
          serviceId,
          { enabled: event.action !== "disable" },
          false,
        );
        sendMessage(
          event.action === "disable"
            ? "Disabled"
            : event.action === "restart"
            ? "Restarted"
            : "Enabled",
          "success",
        );
      }
      service = event.action === "refresh"
        ? await kernel.services.refresh<ServiceStatus>(serviceId)
        : await kernel.services.inspect<ServiceStatus>(serviceId);
    } catch (error) {
      sendMessage(
        error instanceof Error
          ? error.message
          : "Could not update the service.",
        "error",
      );
    }
  }
}

export async function serviceSettings(
  serviceId: string,
  frame = new ScreenFrame(),
): Promise<ScreenResult> {
  const model = serviceDetailModel({
    service: await kernel.services.inspect<ServiceStatus>(serviceId),
  });
  const settings = frame.model(model);
  while (true) {
    const event = await callScreen({
      id: "core-admin-service-settings",
      title: `Configure ${serviceId.split("/").at(-1)}`,
      schema: serviceDetailSchema(model.serviceType, true),
      model: settings,
      controls: [
        "enabled",
        "targetUtilization",
        "sandboxGroup",
        "minimumSandboxes",
        "workersPerSandbox",
        "anonymousUser",
        "minimumWorkers",
        "maximumWorkers",
        "concurrencyPerWorker",
        "workerKeepAlive",
        "serviceType",
        "sessionKeepAlive",
      ].map((bind) => ({ bind })),
      layout: serviceSettingsLayout,
      header: {
        actions: [{ id: "save", label: "Save settings", kind: "primary" }],
      },
    });
    if (event.action === BACK_EVENT) return { view: "back" };
    if (event.action !== "save") continue;
    try {
      if (
        model.maximumWorkers !== 0 &&
        model.maximumWorkers < model.minimumWorkers
      ) {
        throw new Error(
          "Maximum Workers must be zero or at least Minimum Workers.",
        );
      }
      const { applyDesired } = await import("/p/the8020/services/src/admin.ts");
      const { duration } = await import(
        "/p/the8020/services/src/configuration.ts"
      );
      await applyDesired(serviceId, {
        enabled: model.enabled,
        overrides: {
          anonymousUser: model.anonymousUser,
          minimumWorkers: model.minimumWorkers,
          maximumWorkers: model.maximumWorkers,
          concurrencyPerWorker: model.concurrencyPerWorker,
          targetUtilization: model.targetUtilization / 100,
          workerKeepAliveMs:
            duration(model.workerKeepAlive, "Idle Worker timeout") / 1_000_000,
          workersPerSandbox: model.workersPerSandbox,
          sandboxGroup: model.sandboxGroup,
          minimumSandboxes: model.minimumSandboxes,
          serviceType: model.serviceType,
          sessionKeepAliveMs:
            duration(model.sessionKeepAlive, "Idle session timeout") /
            1_000_000,
        },
      }, false);
      sendMessage("Service settings saved.", "success");
      return { view: "back" };
    } catch (error) {
      sendMessage(
        error instanceof Error ? error.message : "Could not save settings.",
        "error",
      );
    }
  }
}
