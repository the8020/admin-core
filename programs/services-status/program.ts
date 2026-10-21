import { listServices } from "/p/the8020/services/src/admin.ts";
import type { ServiceSummary } from "../../src/contracts.ts";

/** Live status for the Home Services tile. */
export default async function servicesStatus() {
  const services = await listServices<ServiceSummary>();
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
