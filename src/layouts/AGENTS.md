Parent DOX: [admin-core/src DOX](../AGENTS.md).

# Purpose

- Own declarative layouts for the shared administration screens.

# Ownership

- Own the package, program, secret, service, and sandbox JSON layouts; sibling
  TypeScript modules supply schemas and models.

# Local Contracts

- Layouts stay serializable and contain no executable code or backend-provided
  CSS.
- Keep bindings aligned with the owning screen schema, retain declarative column
  widths, and use the repository's two-level heading/card hierarchy.

# Work Guidance

- Use shell-owned Back navigation and place non-Back screen actions in headers.

# Verification

- From the repository root, run `deno task check` and `deno task test`.

# Child DOX Index

No child DOX documents. This document owns the entire local scope.
