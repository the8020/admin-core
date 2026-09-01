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
import { packageDetail, packageList } from "./packages.ts";
import { sandboxDetail, sandboxList } from "./sandboxes.ts";
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
    },
  },
  "service.list": { services: [] },
  "service.inspect": {
    service: {
      service_id: "the8020/example/api",
      canonical_base_path: "/the8020/example/api",
      service_type: "stateless",
      access_mode: "authenticated",
      enabled: true,
      desired_generation: 1,
      loaded_generation: 1,
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
      if (operation !== "admin.execute") {
        return Promise.reject(new Error(`unexpected operation ${operation}`));
      }
      const command = String(input.command_id);
      calls.push(command);
      const result = commandResults[command];
      if (result === undefined) {
        return Promise.reject(new Error(`unexpected command ${command}`));
      }
      return Promise.resolve({
        protocol_version: 1,
        success: true,
        result: structuredClone(result),
      });
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
        "package.inspect",
        "package.repository.inspect",
      ],
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
