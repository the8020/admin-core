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
- Sandbox help exposes sandbox ID, state, and reason fields, with ID first.
  Apply ordinary list queries to the cached kernel catalog before paging; send
  only the requested rows. The kernel API returns a full catalog.
- Runtime fields supply known sandbox lifecycle/workload choices. `workerState`
  separately describes the supervisor's lowercase Worker states. Observed fields
  remain strings so incomplete diagnostics stay readable.

# Work Guidance

# Verification

- Run `deno task check` and `deno task test` from the repository root.

# Child DOX Index

No child DOX documents. This document owns the entire local scope.
