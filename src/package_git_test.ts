import { assertEquals } from "@std/assert";
import { type KernelInvoke, kernelInvokeSymbol } from "@the8020/kernel";
import {
  BACK_EVENT,
  type ScreenSnapshot,
  UUI_PROTOCOL_VERSION,
  type UUIClientMessage,
} from "@packages/the8020/uui/mod.ts";
import { bindSession } from "../../uui/session.ts";
import {
  decodeKernelCall,
  kernelFailure,
  kernelSuccess,
} from "./kernel_test_support.ts";
import { packageDetail } from "./packages.ts";

class TestChannel {
  readonly sessionId = "session-package-git";
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

  screens(): ScreenSnapshot[] {
    return this.sent.flatMap((message) => {
      if (
        message !== null && typeof message === "object" &&
        "type" in message && message.type === "screen.show" &&
        "screen" in message
      ) return [message.screen as ScreenSnapshot];
      return [];
    });
  }
}

const repository = {
  package_id: "the8020/example",
  path: "/workspace/packages/the8020/example",
  activation_ready: true,
  branch: "main",
  head: "abcdef1234567890",
  remote_name: "origin",
  remote_url: "https://github.com/the8020/example.git",
  clean: true,
  status: "ready",
  branches: [{
    name: "main",
    commit: "abcdef1234567890",
    current: true,
    remote: false,
  }, {
    name: "stable",
    commit: "1234567abcdef890",
    current: false,
    remote: true,
  }],
  commits: [{
    commit: "abcdef1234567890",
    short_commit: "abcdef1",
    authored_at: "2026-09-01T00:00:00Z",
    author: "Developer",
    subject: "Current",
    current: true,
  }],
};

const index = {
  author: "the8020",
  repository: "example",
  source: "https://github.com/the8020/example.git",
  local: false,
  package_id: "the8020/example",
  valid: true,
};

Deno.test("package detail exposes Git selectors and persists only the secret name", async () => {
  const calls: Array<{ command: string; arguments: Record<string, unknown> }> =
    [];
  (globalThis as unknown as Record<symbol, unknown>)[kernelInvokeSymbol] =
    ((operation, input) => {
      const call = decodeKernelCall(operation, input);
      const command = call.command;
      const arguments_ = call.arguments;
      calls.push({ command, arguments: structuredClone(arguments_) });
      const result: Record<string, unknown> | undefined = {
        "package.inspect": {
          package: {
            package_id: "the8020/example",
            path: "/workspace/packages/the8020/example",
            valid: true,
            service_count: 0,
            services: [],
            programs: [],
            files: [],
          },
        },
        "package.repository.inspect": { repository },
        "package.repository.pull": { repository },
        "package.repository.push": { repository },
        "package.repository.checkout": { repository },
        "package.index.inspect": { package: index },
        "package.index.set": {
          package: { ...index, secret: arguments_.secret },
        },
        "secret.list": {
          secrets: [{
            name: "github",
            updated_at: "2026-09-01T00:00:00Z",
          }],
        },
      }[command];
      if (result === undefined) {
        return Promise.reject(new Error(`unexpected command ${command}`));
      }
      return Promise.resolve(kernelSuccess(call, result));
    }) satisfies KernelInvoke;

  const channel = new TestChannel();
  const unbind = bindSession(channel);
  try {
    const pending = packageDetail("the8020/example");
    const first = await waitForScreen(channel, 1);
    assertEquals(
      first.header.actions.map((action) => action.id).slice(0, 5),
      ["pull", "push", "checkout-branch", "checkout-commit", "save-secret"],
    );
    assertEquals(
      first.fields.find((field) => field.bind === "branch")?.options,
      [
        { value: "main", label: "main (current)" },
        { value: "stable", label: "stable (remote)" },
      ],
    );
    assertEquals(
      first.fields.find((field) => field.bind === "secretName")?.options,
      [
        { value: "", label: "No secret (public repository)" },
        { value: "github", label: "github" },
      ],
    );
    channel.push(screenEvent(first, "pull", 1));
    const second = await waitForScreen(channel, 2);
    channel.push(screenEvent(second, "push", 2));
    const third = await waitForScreen(channel, 3);
    channel.push(screenEvent(third, "checkout-branch", 3, [{
      bind: "branch",
      value: "stable",
    }]));
    const fourth = await waitForScreen(channel, 4);
    channel.push(screenEvent(fourth, "checkout-commit", 4));
    const fifth = await waitForScreen(channel, 5);
    channel.push(screenEvent(fifth, "save-secret", 5, [{
      bind: "secretName",
      value: "github",
    }]));
    const sixth = await waitForScreen(channel, 6);
    channel.push(screenEvent(sixth, BACK_EVENT, 6));
    assertEquals(await pending, { view: "back" });
    assertEquals(
      calls.filter((call) =>
        call.command.startsWith("package.repository.") &&
        call.command !== "package.repository.inspect"
      ),
      [{
        command: "package.repository.pull",
        arguments: { package_id: "the8020/example" },
      }, {
        command: "package.repository.push",
        arguments: { package_id: "the8020/example" },
      }, {
        command: "package.repository.checkout",
        arguments: { package_id: "the8020/example", branch: "stable" },
      }, {
        command: "package.repository.checkout",
        arguments: {
          package_id: "the8020/example",
          commit: "abcdef1234567890",
        },
      }],
    );
    const saved = calls.find((call) => call.command === "package.index.set");
    assertEquals(saved, {
      command: "package.index.set",
      arguments: {
        author: "the8020",
        repository: "example",
        source: "https://github.com/the8020/example.git",
        local: false,
        secret: "github",
      },
    });
    assertEquals(calls.some((call) => call.command === "secret.get"), false);
  } finally {
    unbind();
    delete (globalThis as unknown as Record<symbol, unknown>)[
      kernelInvokeSymbol
    ];
  }
});

Deno.test("package detail keeps Git controls available without index metadata", async () => {
  const calls: string[] = [];
  (globalThis as unknown as Record<symbol, unknown>)[kernelInvokeSymbol] =
    ((operation, input) => {
      const call = decodeKernelCall(operation, input);
      const command = call.command;
      calls.push(command);
      if (command === "package.index.inspect") {
        return Promise.resolve(
          kernelFailure(call, "not_found", "package index is absent"),
        );
      }
      const result: Record<string, unknown> | undefined = {
        "package.inspect": {
          package: {
            package_id: "the8020/example",
            path: "/workspace/packages/the8020/example",
            valid: true,
            service_count: 0,
            services: [],
            programs: [],
            files: [],
          },
        },
        "package.repository.inspect": { repository },
      }[command];
      if (result === undefined) {
        return Promise.reject(new Error(`unexpected command ${command}`));
      }
      return Promise.resolve(kernelSuccess(call, result));
    }) satisfies KernelInvoke;

  const channel = new TestChannel();
  const unbind = bindSession(channel);
  try {
    const pending = packageDetail("the8020/example");
    const screen = await waitForScreen(channel, 1);
    assertEquals(
      screen.header.actions.some((action) => action.id === "save-secret"),
      false,
    );
    assertEquals(
      screen.fields.find((field) => field.bind === "secretName")?.hidden,
      true,
    );
    assertEquals(calls.includes("secret.list"), false);
    channel.push(screenEvent(screen, BACK_EVENT, 1));
    assertEquals(await pending, { view: "back" });
  } finally {
    unbind();
    delete (globalThis as unknown as Record<symbol, unknown>)[
      kernelInvokeSymbol
    ];
  }
});

async function waitForScreen(
  channel: TestChannel,
  count: number,
): Promise<ScreenSnapshot> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const screen = channel.screens()[count - 1];
    if (screen !== undefined) return screen;
    await Promise.resolve();
  }
  throw new Error(`screen ${count} was not shown`);
}

function screenEvent(
  screen: ScreenSnapshot,
  action: string,
  clientSequence: number,
  changes: Array<{ bind: string; value: unknown }> = [],
): Extract<UUIClientMessage, { type: "screen.event" }> {
  return {
    type: "screen.event",
    protocol: UUI_PROTOCOL_VERSION,
    sessionId: "session-package-git",
    screenId: screen.id,
    screenRevision: screen.revision,
    clientSequence,
    action,
    eventType: action === BACK_EVENT ? BACK_EVENT : "action",
    changes,
  };
}
