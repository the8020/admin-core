import { runAdmin } from "../../src/navigation.ts";

export default function workers(workerId?: string): Promise<void> {
  return runAdmin(
    workerId ? { view: "worker", workerId } : { view: "workers" },
  );
}
