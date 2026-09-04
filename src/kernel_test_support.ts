import type { KernelOperation } from "@the8020/kernel";

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
