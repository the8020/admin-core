import { runAdmin } from "../../src/navigation.ts";

export default function secrets(name?: string): Promise<void> {
  return runAdmin(
    name === undefined ? { view: "secrets" } : { view: "secret", name },
  );
}
