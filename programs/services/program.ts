import { runAdmin } from "../../src/navigation.ts";

export default function services(serviceId?: string): Promise<void> {
  return runAdmin(
    serviceId ? { view: "service", serviceId } : { view: "services" },
  );
}
