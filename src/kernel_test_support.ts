import { installContextProvider } from "../../kernel/defaults/config/runtime/deno/context/runtime.ts";
import type { ExecutionContext } from "@the8020/context";
installContextProvider(() => ({ username: "system" } as ExecutionContext));
import type { KernelOperation } from "@the8020/kernel";
import { kernelDatabaseBackendSymbol } from "@the8020/kernel";
(globalThis as unknown as Record<symbol, unknown>)[
  kernelDatabaseBackendSymbol
] = "sqlite";

export function developmentProfileRead(input: Record<string, unknown>) {
  if (
    !(String(input.statement).startsWith("select ") &&
      String(input.statement).includes("the8020__system__settings") &&
      (input.parameters as unknown[])?.[0] === "system.profile")
  ) throw new Error("Unexpected database read");
  return Promise.resolve({
    columns: ["value"],
    rows: [[
      JSON.stringify({
        id: "00000000-0000-4000-8000-000000000001",
        name: "Development",
        role: "development",
      }),
    ]],
  });
}

export interface TestKernelCall {
  command: string;
  arguments: Record<string, unknown>;
  runtime: boolean;
}

export function decodeKernelCall(
  operation: KernelOperation,
  input: Record<string, unknown>,
): TestKernelCall {
  if (operation === "runtime.operation") {
    return {
      command: String(input.operation),
      arguments: (input.input ?? {}) as Record<string, unknown>,
      runtime: true,
    };
  }
  if (operation === "admin.execute") {
    return {
      command: String(input.command_id),
      arguments: (input.arguments ?? {}) as Record<string, unknown>,
      runtime: false,
    };
  }
  throw new Error(`unexpected operation ${operation}`);
}

export function kernelSuccess(
  call: TestKernelCall,
  result: unknown,
): Record<string, unknown> {
  return call.runtime
    ? { success: true, result }
    : { protocol_version: 2, success: true, result };
}

export function kernelFailure(
  call: TestKernelCall,
  code: string,
  message: string,
): Record<string, unknown> {
  const error = { code, message };
  return call.runtime
    ? { success: false, error }
    : { protocol_version: 2, success: false, error };
}
