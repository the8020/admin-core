import { assertEquals } from "@std/assert";
import { type KernelInvoke, kernelInvokeSymbol } from "@the8020/kernel";
import {
  BACK_EVENT,
  type ScreenSnapshot,
  UUI_PROTOCOL_VERSION,
  type UUIClientMessage,
} from "@packages/the8020/uui/mod.ts";
import { bindSession } from "../../uui/session.ts";
import type { ScreenResult } from "./navigation.ts";
import { decodeKernelCall, kernelSuccess } from "./kernel_test_support.ts";
import { packageDetail, packageList } from "./packages.ts";
import { sandboxDetail, sandboxList } from "./sandboxes.ts";
import { secretList } from "./secrets.ts";
import { serviceDetail, serviceList } from "./services.ts";

class TestChannel {
  readonly sessionId = "session-refresh";
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

const commandResults: Record<string, Record<string, unknown>> = {
  "package.list": { packages: [] },
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
  "package.repository.inspect": {
    repository: {
      package_id: "the8020/example",
      path: "/workspace/packages/the8020/example",
      activation_ready: true,
      clean: true,
      status: "ready",
      branches: [],
      commits: [],
    },
  },
  "package.index.inspect": {
    package: {
      author: "the8020",
      repository: "example",
      source: "https://github.com/the8020/example.git",
      local: false,
      package_id: "the8020/example",
      valid: true,
    },
  },
  "secret.list": { secrets: [] },
  "service.list": { services: [] },
  "service.inspect": {
    service: {
      service_id: "the8020/example/api",
      canonical_base_path: "/the8020/example/api",
      service_type: "stateless",
      access_mode: "authenticated",
      enabled: true,
      desired_version: 1,
      loaded_version: 1,
      version_count: 1,
      state: "READY",
      sandbox_count: 0,
      worker_count: 0,
      sandboxes: [],
      effective_configuration: {
        lifecycle: {
          service_type: "stateless",
          session_keep_alive: 120_000_000_000,
        },
        scaling: {
          minimum_workers: 0,
          maximum_workers: 4,
          concurrency_per_worker: 8,
          target_utilization: 0.7,
          worker_keep_alive: 120_000_000_000,
        },
        placement: {
          sandbox_group: "example",
          minimum_sandboxes: 0,
          workers_per_sandbox: 2,
        },
      },
    },
  },
  "sandbox.list": { sandboxes: [] },
  "sandbox.inspect": {
    reason: "service:the8020/example/api",
    sandbox: {
      spec: {
        sandbox_id: "sbx-example",
        runtime_group_id: "rgp-example",
        workload_type: "service",
        group_key: "service:placement:ZXhhbXBsZQ",
        lifecycle: { warm: false },
      },
      status: {
        desired_state: "READY",
        observed_state: "READY",
        worker_count: 0,
      },
      workers: [],
    },
    services: [],
  },
};

Deno.test("live list and detail screens refresh their current target", async () => {
  const calls: string[] = [];
  (globalThis as unknown as Record<symbol, unknown>)[kernelInvokeSymbol] =
    ((operation, input) => {
      const call = decodeKernelCall(operation, input);
      const command = call.command;
      calls.push(command);
      const result = commandResults[command];
      if (result === undefined) {
        return Promise.reject(new Error(`unexpected command ${command}`));
      }
      return Promise.resolve(kernelSuccess(call, structuredClone(result)));
    }) satisfies KernelInvoke;

  const cases: Array<{
    name: string;
    run: () => Promise<ScreenResult>;
    commands: string[];
  }> = [
    {
      name: "package list",
      run: packageList,
      commands: ["package.list", "package.list"],
    },
    {
      name: "package detail",
      run: () => packageDetail("the8020/example"),
      commands: [
        "package.inspect",
        "package.repository.inspect",
        "package.index.inspect",
        "secret.list",
        "package.inspect",
        "package.repository.inspect",
        "package.index.inspect",
        "secret.list",
      ],
    },
    {
      name: "secret list",
      run: secretList,
      commands: ["secret.list", "secret.list"],
    },
    {
      name: "service list",
      run: serviceList,
      commands: ["service.list", "service.list"],
    },
    {
      name: "service detail",
      run: () => serviceDetail("the8020/example/api"),
      commands: ["service.inspect", "service.inspect"],
    },
    {
      name: "sandbox list",
      run: sandboxList,
      commands: ["sandbox.list", "sandbox.list"],
    },
    {
      name: "sandbox detail",
      run: () => sandboxDetail("sbx-example"),
      commands: ["sandbox.inspect", "sandbox.inspect"],
    },
  ];

  try {
    for (const test of cases) {
      calls.length = 0;
      const channel = new TestChannel();
      const unbind = bindSession(channel);
      try {
        const pending = test.run();
        const first = await waitForScreen(channel, 1);
        assertEquals(
          first.header.actions.some((action) => action.id === "refresh"),
          true,
          `${test.name} is missing Refresh`,
        );
        channel.push(screenEvent(channel, first, "refresh", 1));

        const refreshed = await waitForScreen(channel, 2);
        channel.push(screenEvent(channel, refreshed, BACK_EVENT, 2));
        assertEquals(await pending, { view: "back" });
        assertEquals(calls, test.commands, `${test.name} did not reload`);
      } finally {
        unbind();
      }
    }
  } finally {
    delete (globalThis as unknown as Record<symbol, unknown>)[
      kernelInvokeSymbol
    ];
  }
});

Deno.test("package list updates all published packages to latest", async () => {
  const calls: Array<{ command: string; arguments: Record<string, unknown> }> =
    [];
  const indexes = [{
    author: "the8020",
    repository: "alpha",
    source: "https://github.com/the8020/alpha.git",
    tag: "v1.0.0",
    secret: "github",
    local: false,
    package_id: "the8020/alpha",
    valid: true,
  }, {
    author: "the8020",
    repository: "beta",
    source: "https://github.com/the8020/beta.git",
    commit: "abcdef1234567",
    local: false,
    package_id: "the8020/beta",
    valid: true,
  }, {
    author: "the8020",
    repository: "local",
    local: true,
    package_id: "the8020/local",
    valid: true,
  }, {
    author: "the8020",
    repository: "invalid",
    local: false,
    package_id: "the8020/invalid",
    valid: false,
  }];
  (globalThis as unknown as Record<symbol, unknown>)[kernelInvokeSymbol] =
    ((operation, input) => {
      const call = decodeKernelCall(operation, input);
      const command = call.command;
      const arguments_ = structuredClone(call.arguments);
      calls.push({ command, arguments: arguments_ });
      if (command === "package.list") {
        return Promise.resolve(kernelSuccess(call, { packages: [] }));
      }
      if (command === "package.index.list") {
        return Promise.resolve(
          kernelSuccess(call, { packages: structuredClone(indexes) }),
        );
      }
      if (command === "package.index.set") {
        return Promise.resolve(kernelSuccess(call, { package: arguments_ }));
      }
      if (command === "package.synchronize") {
        return Promise.resolve(kernelSuccess(call, {
          packages: ["the8020/alpha", "the8020/beta"].map(
            (package_id) => ({ package_id, commit: "latest", success: true }),
          ),
        }));
      }
      return Promise.reject(new Error(`unexpected command ${command}`));
    }) satisfies KernelInvoke;

  const channel = new TestChannel();
  const unbind = bindSession(channel);
  try {
    const pending = packageList();
    const first = await waitForScreen(channel, 1);
    assertEquals(
      first.header.actions.some((action) => action.id === "update-all"),
      true,
    );
    channel.push(screenEvent(channel, first, "update-all", 1));

    const updated = await waitForScreen(channel, 2);
    channel.push(screenEvent(channel, updated, BACK_EVENT, 2));
    assertEquals(await pending, { view: "back" });
    assertEquals(calls, [{
      command: "package.list",
      arguments: {},
    }, {
      command: "package.index.list",
      arguments: {},
    }, {
      command: "package.index.set",
      arguments: {
        author: "the8020",
        repository: "alpha",
        source: "https://github.com/the8020/alpha.git",
        secret: "github",
      },
    }, {
      command: "package.index.set",
      arguments: {
        author: "the8020",
        repository: "beta",
        source: "https://github.com/the8020/beta.git",
      },
    }, {
      command: "package.synchronize",
      arguments: { packages: "the8020/alpha,the8020/beta" },
    }, {
      command: "package.list",
      arguments: {},
    }]);
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
  channel: TestChannel,
  screen: ScreenSnapshot,
  action: string,
  clientSequence: number,
): Extract<UUIClientMessage, { type: "screen.event" }> {
  return {
    type: "screen.event",
    protocol: UUI_PROTOCOL_VERSION,
    sessionId: channel.sessionId,
    screenId: screen.id,
    screenRevision: screen.revision,
    clientSequence,
    action,
    eventType: action === BACK_EVENT ? BACK_EVENT : "action",
    changes: [],
  };
}
