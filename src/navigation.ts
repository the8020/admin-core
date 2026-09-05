import { ScreenFrame } from "./screen_frame.ts";
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
import { programDetail, programList } from "./programs.ts";

export type AdminTarget =
  | { view: "programs" }
  | { view: "program"; programId: string }
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
  const history: Array<{ target: AdminTarget; frame: ScreenFrame }> = [];
  let current: { target: AdminTarget; frame: ScreenFrame } | undefined = {
    target: initial,
    frame: new ScreenFrame(),
  };
  while (current !== undefined) {
    const next = await show(current.target, current.frame);
    if (next.view === "back") current = history.pop();
    else {
      history.push(current);
      current = { target: next, frame: new ScreenFrame() };
    }
  }
}

function show(target: AdminTarget, frame: ScreenFrame): Promise<ScreenResult> {
  switch (target.view) {
    case "programs":
      return programList(frame);
    case "program":
      return programDetail(target.programId, frame);
    case "packages":
      return packageList(frame);
    case "package":
      return packageDetail(target.packageId, frame);
    case "packageInstall":
      return packageInstall(frame);
    case "packageLocal":
      return packageLocal(frame);
    case "packageVersions":
      return packageVersions(target.packageId, frame);
    case "services":
      return serviceList(frame);
    case "service":
      return serviceDetail(target.serviceId, frame);
    case "sandboxes":
      return sandboxList(frame);
    case "sandbox":
      return sandboxDetail(target.sandboxId, frame);
    case "sandboxHistory":
      return sandboxHistoryList(frame);
    case "sandboxHistoryDetail":
      return sandboxHistoryDetail(target.historyId, frame);
    case "secrets":
      return secretList(frame);
    case "secret":
      return secretEdit(target.name, frame);
  }
}
