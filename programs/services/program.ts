import { runAdmin } from "../../src/navigation.ts";

export default function services(): Promise<void> {
  return runAdmin({ view: "services" });
}
