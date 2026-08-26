import { kernel } from "@platform/kernel";
import { callScreen, field, showNotification, z } from "@platform/uui";
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
  activeSessions: z.number().int(),
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
  instancesMinimum: field(z.number().int().nonnegative(), {
    label: "Minimum",
  }),
  instancesDesired: field(z.number().int().nonnegative(), {
    label: "Desired",
  }),
  instancesMaximum: field(z.number().int().positive(), { label: "Maximum" }),
  workersMinimum: field(z.number().int().nonnegative(), { label: "Minimum" }),
  workersDesired: field(z.number().int().nonnegative(), { label: "Desired" }),
  workersMaximum: field(z.number().int().positive(), { label: "Maximum" }),
  maxInFlight: field(z.number().int().positive(), { label: "Max in flight" }),
  requestTimeout: field(z.string().min(1), { label: "Request timeout" }),
  drainTimeout: field(z.string().min(1), { label: "Drain timeout" }),
  idleTimeout: field(z.string().min(1), { label: "Idle timeout" }),
  dependencyMode: field(z.enum(["cached-only", "online"]), {
    label: "Dependencies",
  }),
  groupKey: field(z.string().min(1), { label: "Group key" }),
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
    actions: [{ id: "back", label: "Back" }],
  });
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
      title: serviceId,
      schema: ServiceDetail,
      model,
      layout: serviceDetailLayout,
      actions: [
        { id: "save", label: "Save", kind: "primary" },
        {
          id: model.enabled ? "disable" : "enable",
          label: model.enabled ? "Disable" : "Enable",
        },
        { id: "restart", label: "Restart" },
        { id: "back", label: "Back" },
      ],
    });
    if (event.action === "back") return { view: "back" };
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
          instances_minimum: model.instancesMinimum,
          instances_desired: model.instancesDesired,
          instances_maximum: model.instancesMaximum,
          workers_minimum: model.workersMinimum,
          workers_desired: model.workersDesired,
          workers_maximum: model.workersMaximum,
          max_in_flight: model.maxInFlight,
          request_timeout: model.requestTimeout,
          drain_timeout: model.drainTimeout,
          idle_timeout: model.idleTimeout,
          dependency_mode: model.dependencyMode,
          group_key: model.groupKey,
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
