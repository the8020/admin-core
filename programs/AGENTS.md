Parent DOX: [admin-core DOX](../AGENTS.md).

# Purpose

- Expose the first-party program, package, secret, service, and sandbox
  administration entrypoints.

# Ownership

- Own each program manifest and thin default-exported entrypoint; `../src/` owns
  navigation, models, and command-result presentation.

# Local Contracts

- Interactive manifests declare `uui = true` and entrypoints remain
  parameterless.
- Route entrypoints through the shared admin navigation; the Programs catalog
  hands execution inputs to the Jobs package.

# Work Guidance

# Verification

- From the repository root, run `deno task check` and `deno task test`.

# Child DOX Index

No child DOX documents. This document owns the entire local scope.
