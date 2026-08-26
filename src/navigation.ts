import { sandboxDetail, sandboxList } from "./sandboxes.ts";
import { serviceDetail, serviceList } from "./services.ts";

export type AdminTarget =
  | { view: "services" }
  | { view: "service"; serviceId: string }
  | { view: "sandboxes" }
  | { view: "sandbox"; sandboxId: string };

export type ScreenResult = AdminTarget | { view: "back" };

export async function runAdmin(initial: AdminTarget): Promise<void> {
  const history: AdminTarget[] = [];
  let target: AdminTarget | undefined = initial;
  while (target !== undefined) {
    const next = await show(target);
    if (next.view === "back") {
      target = history.pop();
    } else {
      history.push(target);
      target = next;
    }
  }
}

function show(target: AdminTarget): Promise<ScreenResult> {
  switch (target.view) {
    case "services":
      return serviceList();
    case "service":
      return serviceDetail(target.serviceId);
    case "sandboxes":
      return sandboxList();
    case "sandbox":
      return sandboxDetail(target.sandboxId);
  }
}
