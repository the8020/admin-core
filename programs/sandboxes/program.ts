import { runAdmin } from "../../src/navigation.ts";

export default function sandboxes(sandboxId?: string): Promise<void> {
  return runAdmin(
    sandboxId ? { view: "sandbox", sandboxId } : { view: "sandboxes" },
  );
}
