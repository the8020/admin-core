import type { WorkerResources } from "@the8020/kernel";
import type { WorkerStatus } from "./contracts.ts";

export function cpuTime(microseconds: number): string {
  return `${(microseconds / 1_000_000).toFixed(2)} s`;
}

export function resourceModel(resources?: WorkerResources) {
  return {
    heap: resources
      ? `${(resources.heap_used_bytes / 1024 / 1024).toFixed(1)} MiB`
      : "Not measured",
    cpu: resources ? cpuTime(resources.cpu_usage_micros) : "Not measured",
    resourceSampledAt: resources?.sampled_at ?? "",
  };
}

export function sumWorkerResources(
  workers: WorkerStatus[],
): WorkerResources | undefined {
  const unique = new Map(workers.map((worker) => [worker.worker_id, worker]));
  const total: WorkerResources = {
    heap_used_bytes: 0,
    cpu_usage_micros: 0,
    sampled_at: "",
  };
  for (const worker of unique.values()) {
    if (!worker.resources) return undefined;
    total.heap_used_bytes += worker.resources.heap_used_bytes;
    total.cpu_usage_micros += worker.resources.cpu_usage_micros;
    const at = worker.resources.sampled_at ?? "";
    if (!total.sampled_at || at < total.sampled_at) total.sampled_at = at;
  }
  return total;
}
