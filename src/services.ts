import { kernel } from "@the8020/kernel";
import {
  BACK_EVENT,
  callScreen,
  field,
  sendMessage,
  z,
} from "@packages/the8020/uui/mod.ts";
import serviceDetailLayout from "./layouts/service-detail.json" with {
  type: "json",
};
import serviceListLayout from "./layouts/service-list.json" with {
  type: "json",
};
import type {
  ServiceInspectResult,
  ServiceListResult,
  ServiceStatus,
  ServiceSummary,
} from "./contracts.ts";
import type { ScreenResult } from "./navigation.ts";
import { serviceDetailModel, serviceRows } from "./view.ts";

const ServiceRow = z.object({
  serviceId: z.string(),
  state: z.string(),
  enabled: z.boolean(),
  versions: z.number().int(),
  sandboxes: z.number().int(),
  workers: z.number().int(),
  serviceType: z.string(),
  description: z.string(),
});
const ServiceList = z.object({ services: z.array(ServiceRow) });

const SandboxRow = z.object({
  navigation: z.string(),
  sandboxId: z.string(),
  version: z.number().int(),
  state: z.string(),
  workers: z.number().int(),
  activeRequests: z.number().int(),
  activeExecutions: z.number().int(),
});
function serviceDetailSchema(serviceType: string) {
  return z.object({
    serviceId: field(z.string(), { label: "Service ID", readOnly: true }),
    description: field(z.string(), { label: "Description", readOnly: true }),
    path: field(z.string(), { label: "Path", readOnly: true }),
    state: field(z.string(), { label: "State", readOnly: true }),
    enabled: field(z.boolean(), { label: "Enabled", readOnly: true }),
    accessMode: field(z.string(), { label: "Access", readOnly: true }),
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
      description: "Zero allows the service to scale to no running Workers.",
    }),
    maximumWorkers: field(z.number().int().nonnegative(), {
      label: "Maximum Workers",
      description:
        "Zero is unlimited at the service level; kernel sandbox and resource limits still apply.",
    }),
    concurrencyPerWorker: field(z.number().int().positive(), {
      label: "Concurrency",
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
      label: "Worker keepalive",
      description: "How long an excess idle Worker remains available.",
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
      label: "Session keepalive",
      hidden: serviceType !== "session",
      description:
        "How long a session environment remains after activity ends.",
    }),
    failure: field(z.string(), { label: "Failure", readOnly: true }),
    sandboxes: z.array(SandboxRow),
  });
}

export async function serviceList(): Promise<ScreenResult> {
  while (true) {
    const result = {
      services: await kernel.services.list<ServiceSummary>(),
    } as ServiceListResult;
    const model = { services: serviceRows(result) };
    const event = await callScreen({
      id: "core-admin-services",
      title: "Services",
      schema: ServiceList,
      model,
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

export async function serviceDetail(serviceId: string): Promise<ScreenResult> {
  let result = {
    service: await kernel.services.inspect<ServiceStatus>(serviceId),
  } as ServiceInspectResult;
  let model = serviceDetailModel(result);
  while (true) {
    const event = await callScreen({
      id: "core-admin-service-detail",
      title: `Service ${serviceId}`,
      schema: serviceDetailSchema(model.serviceType),
      model,
      layout: serviceDetailLayout,
      header: {
        actions: [
          { id: "save", label: "Save", kind: "primary" },
          {
            id: model.enabled ? "disable" : "enable",
            label: model.enabled ? "Disable" : "Enable",
          },
          { id: "restart", label: "Restart" },
          { id: "refresh", label: "[[icon=refresh]] Refresh" },
        ],
      },
    });
    if (event.action === BACK_EVENT) return { view: "back" };
    if (event.action === "change") continue;
    if (
      event.action === "select" && typeof event.value === "string" &&
      event.value.startsWith("sandbox:")
    ) return { view: "sandbox", sandboxId: event.value.slice(8) };
    try {
      if (event.action === "enable") {
        await kernel.services.start(serviceId);
        sendMessage("Enabled", "success");
      }
      if (event.action === "disable") {
        await kernel.services.stop(serviceId);
        sendMessage("Disabled", "success");
      }
      if (event.action === "restart") {
        await kernel.services.restart(serviceId);
        sendMessage("Restarted", "success");
      }
      if (event.action === "save") {
        if (
          model.maximumWorkers !== 0 &&
          model.maximumWorkers < model.minimumWorkers
        ) {
          throw new Error(
            "Maximum Workers must be zero or at least Minimum Workers.",
          );
        }
        await kernel.services.scale({
          service_id: serviceId,
          minimum_workers: model.minimumWorkers,
          maximum_workers: model.maximumWorkers,
          concurrency_per_worker: model.concurrencyPerWorker,
          target_utilization: String(model.targetUtilization / 100),
          worker_keep_alive: model.workerKeepAlive,
          workers_per_sandbox: model.workersPerSandbox,
          sandbox_group: model.sandboxGroup,
          minimum_sandboxes: model.minimumSandboxes,
          service_type: model.serviceType,
          session_keep_alive: model.sessionKeepAlive,
        });
        sendMessage("Saved", "success");
      }
      result = {
        service: await kernel.services.inspect<ServiceStatus>(serviceId),
      } as ServiceInspectResult;
      model = serviceDetailModel(result);
    } catch (error) {
      sendMessage(
        error instanceof Error ? error.message : "Failed",
        "error",
      );
    }
  }
}
