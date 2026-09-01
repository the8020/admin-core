import { runAdmin } from "../../src/navigation.ts";

export default function secrets(): Promise<void> {
  return runAdmin({ view: "secrets" });
}
