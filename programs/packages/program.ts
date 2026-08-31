import { runAdmin } from "../../src/navigation.ts";

export default function packages(): Promise<void> {
  return runAdmin({ view: "packages" });
}
