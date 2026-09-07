import { runAdmin } from "../../src/navigation.ts";

export default function packages(packageId?: string): Promise<void> {
  return runAdmin(
    packageId === undefined
      ? { view: "packages" }
      : { view: "package", packageId },
  );
}
