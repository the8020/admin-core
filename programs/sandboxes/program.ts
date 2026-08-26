import { runAdmin } from "../../src/navigation.ts";

export default function sandboxes(): Promise<void> {
  return runAdmin({ view: "sandboxes" });
}
