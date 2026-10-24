import { assert, assertEquals } from "@std/assert";
import { type KernelInvoke, kernelInvokeSymbol } from "@the8020/kernel";
import { authDatabase } from "/p/the8020/auth/src/test_support.ts";
import {
  BACK_EVENT,
  type ScreenSnapshot,
  UUI_PROTOCOL_VERSION,
  type UUIClientMessage,
} from "/p/the8020/uui/mod.ts";
import { bindSession } from "../../uui/session.ts";
function decodeKernelCall(operation: string, input: Record<string, unknown>) {
  assertEquals(operation, "runtime.operation");
  return {
    command: input.operation,
    arguments: input.input as Record<string, unknown>,
  };
}
function kernelSuccess(_call: unknown, result: unknown) {
  return { success: true, result };
}
import { kernelConsole } from "./kernel-console.ts";
import { kernelLogs } from "./kernel-logs.ts";

class Channel {
  sessionId = "diagnostics";
  sent: Array<Record<string, unknown>> = [];
  screens: ScreenSnapshot[] = [];
  surfaces = new Map<ScreenSnapshot, string>();
  inputs: UUIClientMessage[] = [];
  waiters: Array<(message: UUIClientMessage) => void> = [];
  receive(): Promise<UUIClientMessage> {
    const input = this.inputs.shift();
    return input
      ? Promise.resolve(input)
      : new Promise((resolve) => this.waiters.push(resolve));
  }
  reply(message: UUIClientMessage) {
    const waiter = this.waiters.shift();
    if (waiter) waiter(message);
    else this.inputs.push(message);
  }
  send(raw: unknown) {
    if (typeof raw !== "object" || raw === null) return;
    const message = raw as Record<string, unknown>;
    this.sent.push(message);
    if (message.type === "presentation.show") {
      const presentation = message.presentation as {
        surfaces: Array<{ screen: ScreenSnapshot; surfaceId: string }>;
      };
      const surface = presentation.surfaces.at(-1);
      const screen = surface?.screen;
      const last = this.screens.at(-1);
      if (
        screen && (last?.revision !== screen.revision || last?.id !== screen.id)
      ) {
        this.screens.push(screen);
        this.surfaces.set(screen, surface!.surfaceId);
      }
    }
  }
  async screen(count: number) {
    for (let i = 0; i < 100; i++) {
      if (this.screens.length >= count) return this.screens[count - 1]!;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw new Error("Screen did not appear");
  }
  act(
    screen: ScreenSnapshot,
    action: string,
    changes: Array<{ bind: string; value: unknown }> = [],
  ) {
    this.reply({
      type: "screen.event",
      protocol: UUI_PROTOCOL_VERSION,
      sessionId: this.sessionId,
      surfaceId: this.surfaces.get(screen)!,
      screenId: screen.id,
      screenRevision: screen.revision,
      instanceId: screen.state.instanceId,
      clientSequence: this.screens.length,
      action,
      eventType: action === BACK_EVENT ? BACK_EVENT : "action",
      changes,
      screenState: {
        version: screen.state.version,
        scroll: screen.state.scroll,
        elements: {},
      },
    });
  }
}

Deno.test("console sends native line, replaces results, displays errors and copies plain text", async () => {
  const fixture = await authDatabase();
  const globals = globalThis as unknown as Record<symbol, unknown>;
  const previous = globals[kernelInvokeSymbol];
  const lines: unknown[] = [];
  globals[kernelInvokeSymbol] = ((operation, input) => {
    const call = decodeKernelCall(operation, input);
    assertEquals(call.command, "admin.line");
    lines.push(call.arguments.line);
    return Promise.resolve(
      kernelSuccess(call, {
        exit_code: lines.length === 1 ? 0 : 2,
        output: lines.length === 1
          ? '{"value":"<script>data</script>"}'
          : "invalid_arguments: missing value",
        truncated: false,
      }),
    );
  }) satisfies KernelInvoke;
  const channel = new Channel();
  const unbind = bindSession(channel);
  try {
    const run = kernelConsole();
    void run.catch(() => {});
    channel.act(await channel.screen(1), "run", [{
      bind: "line",
      value: 'kernel.test "two words"',
    }]);
    const result = await channel.screen(2);
    assertEquals(
      result.fields.find((f) => f.bind === "output")?.control,
      "textarea",
    );
    assertEquals(
      result.fields.find((f) => f.bind === "output")?.readOnly,
      true,
    );
    channel.act(result, "copy");
    const copied = await channel.screen(3);
    assert(
      channel.sent.some((m) =>
        m.type === "clipboard.write" &&
        m.text === '{"value":"<script>data</script>"}'
      ),
      JSON.stringify(
        channel.sent.filter((m) => m.type !== "presentation.show"),
      ),
    );
    channel.act(copied, "run", [{ bind: "line", value: "kernel.test" }]);
    const failed = await channel.screen(4);
    assertEquals(
      (failed.model as { output: string }).output,
      "invalid_arguments: missing value",
    );
    assert(failed.description?.includes("Failed"));
    channel.act(failed, BACK_EVENT);
    await run;
    assertEquals(lines, ['kernel.test "two words"', "kernel.test"]);
  } finally {
    unbind();
    globals[kernelInvokeSymbol] = previous;
    fixture.close();
  }
});

Deno.test("log pages reset changed filters, preserve multiline copy and expose expired state", async () => {
  const fixture = await authDatabase();
  const globals = globalThis as unknown as Record<symbol, unknown>;
  const previous = globals[kernelInvokeSymbol];
  const queries: Record<string, unknown>[] = [];
  globals[kernelInvokeSymbol] = ((operation, input) => {
    const call = decodeKernelCall(operation, input);
    assertEquals(call.command, "logs.query");
    queries.push(call.arguments);
    return Promise.resolve(kernelSuccess(
      call,
      queries.length === 4
        ? {
          state: "expired",
          reason: "Retention removed this cursor",
          records: [],
          more: false,
          scanned_bytes: 0,
        }
        : queries.length === 5
        ? {
          state: "unavailable",
          reason: "Node is offline",
          records: [],
          more: false,
          scanned_bytes: 0,
        }
        : {
          state: "ok",
          records: [{
            time: "2026-10-24T00:00:00Z",
            level: "ERROR",
            source: "kernel",
            component: "test",
            node_id: "test",
            message: `page ${queries.length}\nstack line`,
            segment: "segment",
            offset: 0,
          }],
          cursor: `cursor-${queries.length}`,
          more: true,
          scanned_bytes: 100,
          tail_limited: call.arguments.tail === true,
        },
    ));
  }) satisfies KernelInvoke;
  const channel = new Channel();
  const unbind = bindSession(channel);
  try {
    const run = kernelLogs();
    void run.catch(() => {});
    const first = await channel.screen(1);
    assert(
      (first.model as { status: string }).status.includes("Recent window only"),
    );
    channel.act(first, "next");
    const next = await channel.screen(2);
    assertEquals(queries[1]?.cursor, "cursor-1");
    assertEquals(queries[1]?.tail, undefined);
    channel.act(next, "search", [{ bind: "text", value: "needle" }]);
    const filtered = await channel.screen(3);
    assertEquals(queries[2], {
      node_id: "test",
      text: "needle",
      limit: 100,
    });
    channel.act(filtered, "copy");
    const copied = await channel.screen(4);
    assertEquals(queries.length, 3);
    assert(
      channel.sent.some((m) =>
        m.type === "clipboard.write" &&
        String(m.text).includes("page 3\nstack line")
      ),
    );
    channel.act(copied, "next");
    const expired = await channel.screen(5);
    assert((expired.model as { status: string }).status.includes("expired"));
    assertEquals((expired.model as { output: string }).output, "");
    assert(!expired.header.actions.some((a) => a.id === "next"));
    channel.act(expired, "refresh");
    const unavailable = await channel.screen(6);
    assertEquals(queries[4], queries[3]);
    assert(
      (unavailable.model as { status: string }).status.includes(
        "Node is offline",
      ),
    );
    assert(!unavailable.header.actions.some((a) => a.id === "next"));
    channel.act(unavailable, BACK_EVENT);
    await run;
  } finally {
    unbind();
    globals[kernelInvokeSymbol] = previous;
    fixture.close();
  }
});

Deno.test("unprivileged users cannot enter either diagnostics program", async () => {
  const fixture = await authDatabase();
  fixture.asUser("viewer");
  const channel = new Channel();
  const unbind = bindSession(channel);
  try {
    await kernelConsole();
    await kernelLogs();
    assertEquals(channel.screens.length, 0);
    assertEquals(fixture.calls.length, 0);
    assertEquals(
      fixture.database.prepare(
        "SELECT count(*) AS n FROM the8020__auth__failures",
      ).get()?.n,
      2,
    );
  } finally {
    unbind();
    fixture.close();
  }
});

Deno.test("catalog opens a searchable standard modal and Back restores the console", async () => {
  const fixture = await authDatabase();
  const globals = globalThis as unknown as Record<symbol, unknown>;
  const previous = globals[kernelInvokeSymbol];
  globals[kernelInvokeSymbol] = ((operation, input) => {
    const call = decodeKernelCall(operation, input);
    assertEquals(call.command, "admin.catalog");
    return Promise.resolve(kernelSuccess(call, {
      revision: "test",
      commands: [{
        id: "kernel.status",
        name: "kernel.status",
        path: ["kernel.status"],
        summary: "Inspect the kernel",
        kind: "native",
        mutates_state: false,
      }],
    }));
  }) satisfies KernelInvoke;
  const channel = new Channel();
  const unbind = bindSession(channel);
  try {
    const run = kernelConsole();
    void run.catch(() => {});
    const first = await channel.screen(1);
    channel.act(first, "calls");
    const picker = await channel.screen(2);
    assertEquals(picker.id, "kernel-call-picker");
    const layout = picker.layout as {
      root: { key: string; focusSearch: boolean };
    };
    assertEquals(layout.root.key, "name");
    assertEquals(layout.root.focusSearch, true);
    channel.act(picker, BACK_EVENT);
    for (let i = 0; i < 100; i++) {
      const last = channel.screens.at(-1)!;
      if (last.id === first.id && last.revision !== first.revision) {
        channel.act(last, BACK_EVENT);
        await run;
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw new Error("Console was not restored");
  } finally {
    unbind();
    globals[kernelInvokeSymbol] = previous;
    fixture.close();
  }
});
