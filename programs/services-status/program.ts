import { text } from "/p/the8020/i18n/mod.ts";
import { msg } from "/p/the8020/admin-core/i18n/messages.ts";
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
    detail: failing === 0
      ? text(msg("widgets.healthy"))
      : text(msg("widgets.failing", { count: failing })),
    status: failing === 0 ? "ok" : "danger",
  };
}
