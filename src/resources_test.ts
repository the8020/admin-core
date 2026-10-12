import { assertEquals } from "@std/assert";
import { resourceModel, sumWorkerResources } from "./resources.ts";

Deno.test("Worker resource totals deduplicate Workers and retain the oldest sample", () => {
  const worker = {
    worker_id: "wrk-0123456789",
    owner_id: "example",
    state: "ready",
    in_flight: 0,
    resources: {
      heap_used_bytes: 1024 * 1024,
      cpu_usage_micros: 1_000_000,
      sampled_at: "2026-10-12T10:00:00Z",
    },
  };
  const other = {
    ...worker,
    worker_id: "wrk-abcdefghij",
    resources: { ...worker.resources, sampled_at: "2026-10-12T09:00:00Z" },
  };
  assertEquals(resourceModel(sumWorkerResources([worker, other, worker])), {
    heap: "2.0 MiB",
    cpu: "2.00 s",
    resourceSampledAt: "2026-10-12T09:00:00Z",
  });
  assertEquals(
    sumWorkerResources([{ ...worker, resources: undefined }]),
    undefined,
  );
  assertEquals(resourceModel(undefined).heap, "Not measured");
  assertEquals(resourceModel(sumWorkerResources([])).cpu, "0.00 s");
});
