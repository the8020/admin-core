import { field, z } from "/p/the8020/db/fields.ts";

export const sandboxId: z.ZodString = field(z.string(), {
  label: "Sandbox",
  description:
    "A running environment for services and background work. Open it to see activity, resource use, and Workers.",
  valueHelp: async ({ query, offset, limit }) => {
    const { kernel } = await import("@the8020/kernel");
    const { sandboxes } = await kernel.admin.execute<{
      sandboxes: Array<{ sandbox_id: string; reason: string; state: string }>;
    }>("sandbox.list");
    const search = query.trim().toLowerCase();
    const matches = sandboxes.filter((row) =>
      `${row.sandbox_id} ${row.reason} ${row.state}`.toLowerCase().includes(
        search,
      )
    )
      .sort((a, b) => a.sandbox_id.localeCompare(b.sandbox_id));
    return {
      items: matches.slice(offset, offset + limit).map((row) => ({
        value: row.sandbox_id,
        label: row.sandbox_id,
        description: `${row.state} · ${row.reason}`,
      })),
      more: offset + limit < matches.length,
    };
  },
  open: async (value) => {
    const { default: sandboxes } = await import(
      "../programs/sandboxes/program.ts"
    );
    await sandboxes(value);
  },
});

export const workerId: z.ZodString = field(z.string(), {
  label: "Worker",
  description:
    "A Worker runs a service or background program inside a sandbox. Open it to see its activity and owning workload.",
  open: async (value) => {
    const { default: workers } = await import("../programs/workers/program.ts");
    await workers(value);
  },
});
