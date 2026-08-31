import { kernel } from "@the8020/kernel";
import {
  BACK_EVENT,
  callScreen,
  field,
  showNotification,
  z,
} from "@packages/the8020/uui/mod.ts";
import serviceDetailLayout from "./layouts/service-detail.json" with {
  type: "json",
};
import serviceListLayout from "./layouts/service-list.json" with {
  type: "json",
};
import type { ServiceInspectResult, ServiceListResult } from "./contracts.ts";
import type { ScreenResult } from "./navigation.ts";
import { serviceDetailModel, serviceRows } from "./view.ts";

const ServiceRow = z.object({
  serviceId: z.string(),
  state: z.string(),
  enabled: z.boolean(),
  instances: z.number().int(),
  workers: z.number().int(),
  mode: z.string(),
  description: z.string(),
});
const ServiceList = z.object({ services: z.array(ServiceRow) });

const SandboxRow = z.object({
  navigation: z.string(),
  sandboxId: z.string(),
  state: z.string(),
  workers: z.number().int(),
  activeRequests: z.number().int(),
  activeExecutions: z.number().int(),
});
const ServiceDetail = z.object({
  serviceId: field(z.string(), { label: "Service ID", readOnly: true }),
  description: field(z.string(), { label: "Description", readOnly: true }),
  path: field(z.string(), { label: "Path", readOnly: true }),
  state: field(z.string(), { label: "State", readOnly: true }),
  enabled: field(z.boolean(), { label: "Enabled", readOnly: true }),
  executionMode: field(z.string(), { label: "Execution", readOnly: true }),
  accessMode: field(z.string(), { label: "Access", readOnly: true }),
  desiredGeneration: field(z.number().int(), {
    label: "Desired generation",
    readOnly: true,
  }),
  loadedGeneration: field(z.number().int(), {
    label: "Loaded generation",
    readOnly: true,
  }),
  replicasMinimum: field(z.number().int().positive(), {
    label: "Minimum",
  }),
  replicasMaximum: field(z.number().int().positive(), { label: "Maximum" }),
  workersMinimum: field(z.number().int().positive(), { label: "Minimum" }),
  workersMaximum: field(z.number().int().positive(), { label: "Maximum" }),
  concurrencyPerWorker: field(z.number().int().positive(), {
    label: "Concurrency per Worker",
  }),
  targetUtilization: field(z.number().int().min(1).max(100), {
    label: "Target utilization",
    control: "range",
    minimum: 1,
    maximum: 100,
    step: 1,
    valueSuffix: "%",
  }),
  keepAlive: field(z.string().min(1), { label: "Persistent keepalive" }),
  sandboxGroup: field(z.string(), { label: "Sandbox group" }),
  failure: field(z.string(), { label: "Failure", readOnly: true }),
  sandboxes: z.array(SandboxRow),
});

export async function serviceList(): Promise<ScreenResult> {
  const result = await kernel.admin.execute<ServiceListResult>("service.list");
  const model = { services: serviceRows(result) };
  const event = await callScreen({
    id: "core-admin-services",
    title: "Services",
    schema: ServiceList,
    model,
    layout: serviceListLayout,
  });
  if (event.action === BACK_EVENT) return { view: "back" };
  return event.action === "select" && typeof event.value === "string"
    ? { view: "service", serviceId: event.value }
    : { view: "back" };
}

export async function serviceDetail(serviceId: string): Promise<ScreenResult> {
  while (true) {
    const result = await kernel.admin.execute<ServiceInspectResult>(
      "service.inspect",
      { service_id: serviceId },
    );
    const model = serviceDetailModel(result);
    const event = await callScreen({
      id: "core-admin-service-detail",
      title: `Service ${serviceId}`,
      schema: ServiceDetail,
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
        ],
      },
    });
    if (event.action === BACK_EVENT) return { view: "back" };
    if (
      event.action === "select" && typeof event.value === "string" &&
      event.value.startsWith("sandbox:")
    ) return { view: "sandbox", sandboxId: event.value.slice(8) };
    try {
      if (event.action === "enable") {
        await kernel.admin.execute("service.start", { service_id: serviceId });
        showNotification("Enabled", "success");
      }
      if (event.action === "disable") {
        await kernel.admin.execute("service.stop", { service_id: serviceId });
        showNotification("Disabled", "success");
      }
      if (event.action === "restart") {
        await kernel.admin.execute("service.restart", {
          service_id: serviceId,
        });
        showNotification("Restarted", "success");
      }
      if (event.action === "save") {
        await kernel.admin.execute("service.scale", {
          service_id: serviceId,
          replicas_min: model.replicasMinimum,
          replicas_max: model.replicasMaximum,
          workers_per_replica_min: model.workersMinimum,
          workers_per_replica_max: model.workersMaximum,
          concurrency_per_worker: model.concurrencyPerWorker,
          target_utilization: String(model.targetUtilization / 100),
          keep_alive: model.keepAlive,
          sandbox_group: model.sandboxGroup,
        });
        showNotification("Saved", "success");
      }
    } catch (error) {
      showNotification(
        error instanceof Error ? error.message : "Failed",
        "error",
      );
    }
  }
}
