import {
  serviceInfo,
  serviceSettings as servicePolicy,
} from "/p/the8020/services/types/service.ts";
import { runtimeInfo } from "../types/runtime.ts";
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
  state: serviceInfo.shape.state,
  enabled: serviceInfo.shape.enabled,
  versions: serviceInfo.shape.versionCount,
  sandboxes: runtimeInfo.shape.sandboxCount,
  workers: runtimeInfo.shape.workerCount,
  serviceType: serviceInfo.shape.serviceType,
  description: serviceInfo.shape.description,
});
const ServiceList = z.object({ services: z.array(ServiceRow) });

const SandboxRow = z.object({
  navigation: z.string(),
  sandboxId: sandboxField,
  version: serviceInfo.shape.version,
  state: runtimeInfo.shape.state,
  workers: runtimeInfo.shape.workerCount,
  activeRequests: runtimeInfo.shape.activeRequests,
  activeExecutions: runtimeInfo.shape.activeExecutions,
  snapshotRevision: runtimeInfo.shape.snapshotRevision,
  snapshotObservedAt: runtimeInfo.shape.snapshotObservedAt,
});
function serviceDetailSchema(serviceType: string, editing = false) {
  return z.object({
    serviceId: field(serviceField, { readOnly: true }),
    packageId: field(packageField, { readOnly: true }),
    description: field(serviceInfo.shape.description, { readOnly: true }),
    path: field(serviceInfo.shape.path, { readOnly: true }),
    state: field(serviceInfo.shape.state, { readOnly: true }),
    workerCount: field(runtimeInfo.shape.workerCount, {
      label: "Running Workers",
      readOnly: true,
    }),
    sandboxCount: field(runtimeInfo.shape.sandboxCount, { readOnly: true }),
    versionCount: field(serviceInfo.shape.versionCount, { readOnly: true }),
    enabled: field(serviceInfo.shape.enabled, { readOnly: !editing }),
    accessMode: editing
      ? field(servicePolicy.shape.accessMode, {
        options: [
          { value: "public", label: "Public" },
          { value: "authenticated", label: "Private" },
        ],
      })
      : field(serviceInfo.shape.accessMode, { readOnly: true }),
    anonymousUser: servicePolicy.shape.anonymousUser,
    desiredVersion: field(serviceInfo.shape.desiredVersion, { readOnly: true }),
    loadedVersion: field(serviceInfo.shape.loadedVersion, { readOnly: true }),
    minimumWorkers: servicePolicy.shape.minimumWorkers,
    maximumWorkers: servicePolicy.shape.maximumWorkers,
    concurrencyPerWorker: servicePolicy.shape.concurrencyPerWorker,
    targetUtilization: field(servicePolicy.shape.targetUtilizationPercent, {
      control: "range",
      minimum: 1,
      maximum: 100,
      step: 0.1,
      valueSuffix: "%",
    }),
    workerKeepAlive: servicePolicy.shape.workerKeepAlive,
    sandboxGroup: servicePolicy.shape.sandboxGroup,
    minimumSandboxes: servicePolicy.shape.minimumSandboxes,
    workersPerSandbox: servicePolicy.shape.workersPerSandbox,
    serviceType: field(servicePolicy.shape.serviceType, { reactive: true }),
    sessionKeepAlive: field(servicePolicy.shape.sessionKeepAlive, {
      hidden: serviceType !== "session",
    }),
    failure: field(runtimeInfo.shape.failure, { readOnly: true }),
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
        "accessMode",
        "anonymousUser",
        "serviceType",
        "targetUtilization",
        "sandboxGroup",
        "minimumSandboxes",
        "workersPerSandbox",
        "minimumWorkers",
        "maximumWorkers",
        "concurrencyPerWorker",
        "workerKeepAlive",
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
          accessMode: servicePolicy.shape.accessMode.parse(model.accessMode),
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
            duration(model.sessionKeepAlive, "Idle session timeout", true) /
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
