import { kernel } from "@the8020/kernel";
import type { ServiceSummary } from "../../src/contracts.ts";

/** Live status for the Home Services tile. */
export default async function servicesStatus() {
  const services = await kernel.services.list<ServiceSummary>();
  const enabled = services.filter((service) => service.enabled);
  const failing =
    enabled.filter((service) =>
      service.state === "FAILED" || service.validation_error !== undefined
    ).length;
  return {
    value: `${enabled.length}/${services.length}`,
    detail: failing === 0 ? "enabled, all healthy" : `${failing} failing`,
    status: failing === 0 ? "ok" : "danger",
  };
}
