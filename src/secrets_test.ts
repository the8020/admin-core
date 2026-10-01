import { assertEquals } from "@std/assert";
import { type KernelInvoke, kernelInvokeSymbol } from "@the8020/kernel";
import {
  type ScreenSnapshot,
  UUI_PROTOCOL_VERSION,
  type UUIClientMessage,
} from "/p/the8020/uui/mod.ts";
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
        "type" in message && message.type === "presentation.show" &&
        "presentation" in message
      ) {
        const presentation = message.presentation as {
          activeSurfaceId: string | null;
          surfaces: Array<{ screen: ScreenSnapshot }>;
        };
        if (presentation.activeSurfaceId !== null) {
          return presentation.surfaces.at(-1)?.screen;
        }
      }
    }
    return undefined;
  }
}

Deno.test("secret edit starts blank, stays masked, and overwrites without reading", async () => {
  const calls: Array<{ command: string; arguments: Record<string, unknown> }> =
    [];
  (globalThis as unknown as Record<symbol, unknown>)[kernelInvokeSymbol] =
    ((operation, input) => {
      if (operation === "database.execute") {
        calls.push({ command: operation, arguments: structuredClone(input) });
        return Promise.resolve({
          columns: [],
          rows: [],
          affected_rows: { type: "bigint", value: "1" },
        });
      }
      const call = decodeKernelCall(operation, input);
      const command = call.command;
      const arguments_ = call.arguments;
      calls.push({ command, arguments: structuredClone(arguments_) });
      if (command !== "crypto.encrypt") {
        return Promise.reject(new Error(`unexpected command ${command}`));
      }
      return Promise.resolve(kernelSuccess(call, {
        encrypted: "v1:encrypted",
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
      surfaceId: "surface-1",
      screenId: screen.id,
      screenRevision: screen.revision,
      instanceId: screen.state.instanceId,
      screenState: {
        version: screen.state.version,
        scroll: screen.state.scroll,
        elements: {},
      },
      clientSequence: 1,
      action: "save",
      eventType: "action",
      changes: [{ bind: "value", value: "  replacement-token  " }],
    });
    assertEquals(await pending, { view: "back" });
    assertEquals(calls.map((call) => call.command), [
      "crypto.encrypt",
      "database.execute",
    ]);
    assertEquals(calls[0]!.arguments, {
      purpose: "app-secret-store",
      data: new TextEncoder().encode("  replacement-token  ").toBase64(),
      associated_data: new TextEncoder().encode("github").toBase64(),
    });
    assertEquals(
      String(calls[1]!.arguments.statement).startsWith("insert "),
      true,
    );
    assertEquals(
      (calls[1]!.arguments.parameters as unknown[]).includes("v1:encrypted"),
      true,
    );
    assertEquals(
      JSON.stringify(calls[1]!.arguments).includes("replacement-token"),
      false,
    );
  } finally {
    unbind();
    delete (globalThis as unknown as Record<symbol, unknown>)[
      kernelInvokeSymbol
    ];
  }
});
