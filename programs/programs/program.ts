import { runAdmin } from "../../src/navigation.ts";

export default function programs(): Promise<void> {
  return runAdmin({ view: "programs" });
}
