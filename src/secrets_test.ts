import { assertEquals } from "@std/assert";
import { type KernelInvoke, kernelInvokeSymbol } from "@the8020/kernel";
import {
  type ScreenSnapshot,
  UUI_PROTOCOL_VERSION,
  type UUIClientMessage,
} from "@packages/the8020/uui/mod.ts";
import { bindSession } from "../../uui/session.ts";
import { decodeKernelCall, kernelSuccess } from "./kernel_test_support.ts";
import { secretEdit } from "./secrets.ts";

class TestChannel {
  readonly sessionId = "session-secrets";
  readonly sent: unknown[] = [];
  #inputs: UUIClientMessage[] = [];
  #waiters: Array<(message: UUIClientMessage) => void> = [];

  send(message: unknown): void {
    this.sent.push(message);
  }

  receive(): Promise<UUIClientMessage> {
    const input = this.#inputs.shift();
    if (input !== undefined) return Promise.resolve(input);
    return new Promise((resolve) => this.#waiters.push(resolve));
  }

  push(message: UUIClientMessage): void {
    const waiter = this.#waiters.shift();
    if (waiter === undefined) this.#inputs.push(message);
    else waiter(message);
  }

  screen(): ScreenSnapshot | undefined {
    for (const message of this.sent) {
      if (
        message !== null && typeof message === "object" &&
        "type" in message && message.type === "screen.show" &&
        "screen" in message
      ) return message.screen as ScreenSnapshot;
    }
    return undefined;
  }
}

Deno.test("secret edit starts blank, stays masked, and overwrites without reading", async () => {
  const calls: Array<{ command: string; arguments: Record<string, unknown> }> =
    [];
  (globalThis as unknown as Record<symbol, unknown>)[kernelInvokeSymbol] =
    ((operation, input) => {
      const call = decodeKernelCall(operation, input);
      const command = call.command;
      const arguments_ = call.arguments;
      calls.push({ command, arguments: structuredClone(arguments_) });
      if (command !== "secret.set") {
        return Promise.reject(new Error(`unexpected command ${command}`));
      }
      return Promise.resolve(kernelSuccess(call, {
        secret: {
          name: arguments_.name,
          updated_at: "2026-09-01T00:00:00Z",
        },
      }));
    }) satisfies KernelInvoke;

  const channel = new TestChannel();
  const unbind = bindSession(channel);
  try {
    const pending = secretEdit("github");
    let screen: ScreenSnapshot | undefined;
    for (let attempt = 0; attempt < 100; attempt++) {
      screen = channel.screen();
      if (screen !== undefined) break;
      await Promise.resolve();
    }
    if (screen === undefined) throw new Error("secret screen was not shown");
    assertEquals(screen.model, { name: "github", value: "" });
    assertEquals(
      screen.fields.find((field) => field.bind === "value")?.control,
      "password",
    );
    channel.push({
      type: "screen.event",
      protocol: UUI_PROTOCOL_VERSION,
      sessionId: channel.sessionId,
      screenId: screen.id,
      screenRevision: screen.revision,
      clientSequence: 1,
      action: "save",
      eventType: "action",
      changes: [{ bind: "value", value: "  replacement-token  " }],
    });
    assertEquals(await pending, { view: "back" });
    assertEquals(calls, [{
      command: "secret.set",
      arguments: { name: "github", value: "  replacement-token  " },
    }]);
  } finally {
    unbind();
    delete (globalThis as unknown as Record<symbol, unknown>)[
      kernelInvokeSymbol
    ];
  }
});
