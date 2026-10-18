import { assertEquals, assertRejects } from "@std/assert";
import {
  type KernelInvoke,
  kernelInvokeSymbol,
  type PackageRepository,
  type PackageVersion,
  type PackageVersions,
} from "@the8020/kernel";
import {
  applyPackageUpdate,
  availableUpdate,
  fetchPackageUpdate,
  updateState,
} from "./package-updates.ts";
import {
  decodeKernelCall,
  developmentProfileRead,
  kernelFailure,
  kernelSuccess,
} from "./kernel_test_support.ts";

function version(
  commit: string,
  parents: string[],
  tags: string[] = [],
): PackageVersion {
  return {
    commit,
    parents,
    tags,
    short_commit: commit,
    authored_at: "",
    author: "",
    subject: "",
    current: false,
    selected: false,
  };
}

const repository: PackageRepository = {
  package_id: "acme/example",
  path: "/workspace/packages/acme/example",
  activation_ready: true,
  clean: true,
  status: "ready",
  head: "old",
  branch: "main",
  remote_name: "origin",
  remote_url: "https://example.test/acme/example.git",
  branches: [],
  commits: [],
};
const versions: PackageVersions = {
  package_id: repository.package_id,
  current_commit: "old",
  versions: [
    version("unreleased", ["new"], ["1.0.0-rc.1"]),
    version("new", ["middle"], ["v0.10.0"]),
    version("middle", ["old"], ["0.9.10"]),
    version("old", [], ["0.9.9"]),
  ],
};

Deno.test("package update selects numeric releases, proves ancestry, and never downgrades", () => {
  const available = availableUpdate(versions);
  assertEquals(available, {
    state: "available",
    current: "old",
    target: "new",
    tag: "v0.10.0",
  });
  assertEquals(
    availableUpdate({ ...versions, current_commit: "new" }).state,
    "current",
  );
  assertEquals(
    availableUpdate({ ...versions, current_commit: "unreleased" }).state,
    "current",
  );
  assertEquals(
    availableUpdate({ ...versions, current_commit: "diverged" }).state,
    "blocked",
  );
  assertEquals(
    availableUpdate({
      ...versions,
      versions: [version("new", ["outside-window"], ["0.10.0"])],
    }).state,
    "blocked",
  );
  const untagged = {
    ...versions,
    versions: versions.versions.map((item) => ({ ...item, tags: [] })),
  };
  assertEquals(availableUpdate(untagged, "new").state, "available");
  assertEquals(availableUpdate(untagged).state, "blocked");
  assertEquals(updateState(repository, available).state, "available");
  assertEquals(
    updateState({ ...repository, remote_url: undefined }, available).state,
    "unavailable",
  );
  assertEquals(
    updateState({ ...repository, clean: false }, available).state,
    "modified",
  );
  assertEquals(
    updateState({ ...repository, head: "changed" }, available).state,
    "unchecked",
  );
  assertEquals(
    updateState({ ...repository, head: "new" }, available).state,
    "current",
  );
});

Deno.test("package update skips no remote, local edits, changed HEAD, and unchecked packages before mutation", async () => {
  const globals = globalThis as unknown as Record<symbol, unknown>;
  const previous = globals[kernelInvokeSymbol];
  let inspected = repository;
  const calls: string[] = [];
  globals[kernelInvokeSymbol] = ((operation, input) => {
    const call = decodeKernelCall(operation, input);
    calls.push(call.command);
    assertEquals(call.command, "package.repository.inspect");
    return Promise.resolve(kernelSuccess(call, { repository: inspected }));
  }) satisfies KernelInvoke;
  try {
    const checked = availableUpdate(versions);
    inspected = {
      ...repository,
      remote_name: undefined,
      remote_url: undefined,
    };
    assertEquals(
      (await fetchPackageUpdate(repository.package_id)).state,
      "unavailable",
    );
    assertEquals(
      await applyPackageUpdate(repository.package_id, checked),
      "skipped",
    );
    inspected = { ...repository, clean: false };
    assertEquals(
      await applyPackageUpdate(repository.package_id, checked),
      "skipped",
    );
    inspected = { ...repository, head: "changed" };
    assertEquals(
      await applyPackageUpdate(repository.package_id, checked),
      "skipped",
    );
    inspected = repository;
    assertEquals(await applyPackageUpdate(repository.package_id), "skipped");
    assertEquals(calls.length, 5);
  } finally {
    if (previous === undefined) delete globals[kernelInvokeSymbol];
    else globals[kernelInvokeSymbol] = previous;
  }
});

Deno.test("failed activation preserves the desired version and returns the native error", async () => {
  const globals = globalThis as unknown as Record<symbol, unknown>;
  const previous = globals[kernelInvokeSymbol];
  const calls: string[] = [];
  globals[kernelInvokeSymbol] = ((operation, input) => {
    if (operation === "database.execute") return developmentProfileRead(input);
    const call = decodeKernelCall(operation, input);
    calls.push(call.command);
    if (call.command === "package.repository.inspect") {
      return Promise.resolve(kernelSuccess(call, { repository }));
    }
    if (call.command === "package.index.inspect") {
      return Promise.resolve(
        kernelSuccess(call, { package: { local: false } }),
      );
    }
    if (call.command === "package.repository.checkout") {
      return Promise.resolve(
        kernelFailure(call, "runtime_operation", "Schema activation failed"),
      );
    }
    throw new Error(`Unexpected mutation ${call.command}`);
  }) satisfies KernelInvoke;
  try {
    await assertRejects(
      () =>
        applyPackageUpdate(repository.package_id, availableUpdate(versions)),
      Error,
      "Schema activation failed",
    );
    assertEquals(calls, [
      "package.repository.inspect",
      "package.index.inspect",
      "package.repository.checkout",
    ]);
  } finally {
    if (previous === undefined) delete globals[kernelInvokeSymbol];
    else globals[kernelInvokeSymbol] = previous;
  }
});

Deno.test("untagged packages fetch the current remote branch and retain its exact selected commit", async () => {
  const globals = globalThis as unknown as Record<symbol, unknown>;
  const previous = globals[kernelInvokeSymbol];
  const calls: Array<{ command: string; arguments: Record<string, unknown> }> =
    [];
  globals[kernelInvokeSymbol] = ((operation, input) => {
    if (operation === "database.execute") return developmentProfileRead(input);
    const call = decodeKernelCall(operation, input);
    calls.push(call);
    const results: Record<string, unknown> = {
      "package.repository.inspect": {
        repository: { ...repository, branch: "stable" },
      },
      "package.repository.fetch": { repository },
      "package.version.list": {
        package: {
          ...versions,
          versions: versions.versions.map((item) => ({ ...item, tags: [] })),
        },
      },
      "package.index.inspect": {
        package: {
          author: "acme",
          repository: "example",
          source: repository.remote_url,
          secret: "private-git",
          local: false,
        },
      },
      "package.source.inspect": {
        source: {
          default_branch: "main",
          references: [
            { kind: "branch", name: "main", commit: "unreleased" },
            { kind: "branch", name: "stable", commit: "new" },
          ],
        },
      },
      "package.repository.checkout": {
        repository: { ...repository, head: "new" },
      },
      "package.index.set": { package: call.arguments },
    };
    if (!(call.command in results)) {
      throw new Error(`Unexpected command ${call.command}`);
    }
    return Promise.resolve(kernelSuccess(call, results[call.command]));
  }) satisfies KernelInvoke;
  try {
    const checked = await fetchPackageUpdate(repository.package_id);
    assertEquals(checked, {
      state: "available",
      current: "old",
      target: "new",
      tag: undefined,
    });
    assertEquals(
      calls.find((call) => call.command === "package.source.inspect")
        ?.arguments,
      { source: repository.remote_url, secret: "private-git" },
    );
    assertEquals(
      await applyPackageUpdate(repository.package_id, checked),
      "updated",
    );
    assertEquals(calls.at(-1)?.arguments, {
      author: "acme",
      repository: "example",
      source: repository.remote_url,
      secret: "private-git",
      commit: "new",
    });
  } finally {
    if (previous === undefined) delete globals[kernelInvokeSymbol];
    else globals[kernelInvokeSymbol] = previous;
  }
});
