Parent DOX: [admin-core DOX](../AGENTS.md).

# Purpose

- Share runtime identity, status, capacity, diagnostic, and archive fields
  across administration forms and lists.

# Ownership

- `runtime.ts` defines sandbox/Worker references and `runtimeInfo` metadata.
  Sandbox-group fields are shared by service and job configuration. Archived
  sandbox references suppress live lookup and navigation. Source entrypoints
  reuse package fields. The kernel owns runtime identity validation, authority,
  and lifecycle; this package owns their presentation.

# Local Contracts

- Field callbacks open the owning public UUI program with a selected ID.
- Sandbox help filters the existing cached kernel catalog server-side and sends
  only the requested batch to the browser. The kernel API returns a full
  catalog.

# Work Guidance

# Verification

- Run `deno task check` and `deno task test` from the repository root.

# Child DOX Index

No child DOX documents. This document owns the entire local scope.
