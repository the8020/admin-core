import {
  sandboxDetail,
  sandboxHistoryDetail,
  sandboxHistoryList,
  sandboxList,
} from "./sandboxes.ts";
import {
  packageInstall,
  packageLocal,
  packageVersions,
} from "./package-management.ts";
import { packageDetail, packageList } from "./packages.ts";
import { serviceDetail, serviceList } from "./services.ts";
import { secretEdit, secretList } from "./secrets.ts";

export type AdminTarget =
  | { view: "packages" }
  | { view: "package"; packageId: string }
  | { view: "packageInstall" }
  | { view: "packageLocal" }
  | { view: "packageVersions"; packageId: string }
  | { view: "services" }
  | { view: "service"; serviceId: string }
  | { view: "sandboxes" }
  | { view: "sandbox"; sandboxId: string }
  | { view: "sandboxHistory" }
  | { view: "sandboxHistoryDetail"; historyId: string }
  | { view: "secrets" }
  | { view: "secret"; name?: string };

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
    case "packages":
      return packageList();
    case "package":
      return packageDetail(target.packageId);
    case "packageInstall":
      return packageInstall();
    case "packageLocal":
      return packageLocal();
    case "packageVersions":
      return packageVersions(target.packageId);
    case "services":
      return serviceList();
    case "service":
      return serviceDetail(target.serviceId);
    case "sandboxes":
      return sandboxList();
    case "sandbox":
      return sandboxDetail(target.sandboxId);
    case "sandboxHistory":
      return sandboxHistoryList();
    case "sandboxHistoryDetail":
      return sandboxHistoryDetail(target.historyId);
    case "secrets":
      return secretList();
    case "secret":
      return secretEdit(target.name);
  }
}
