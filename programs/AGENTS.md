Parent DOX: [admin-core DOX](../AGENTS.md).

# Purpose

- Expose the first-party program, package, secret, service, sandbox, and Worker
  administration entrypoints.

# Ownership

- Own each program manifest and thin default-exported entrypoint; `../src/` owns
  navigation, models, and command-result presentation.

# Local Contracts

- Interactive manifests declare `uui = true`. Calling without arguments opens
  the catalog; Programs, Packages, Secrets, Services, Sandboxes, and Workers
  accept an optional selected identifier.
- Route entrypoints through the shared admin navigation; the Programs catalog
  hands execution inputs to the Jobs package.

# Work Guidance

# Verification

- From the repository root, run `deno task check` and `deno task test`.

# Child DOX Index

No child DOX documents. This document owns the entire local scope.
