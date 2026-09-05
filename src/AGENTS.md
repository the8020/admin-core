Parent DOX: [admin-core DOX](../AGENTS.md).

# Purpose

- Implement shared administration screens, navigation, and typed result models.

# Ownership

- Own `navigation.ts`, `screen_frame.ts`, domain screen modules, `contracts.ts`,
  presentation helpers, and colocated tests.
- The layouts child owns declarative JSON; kernel and package APIs own mutations
  and runtime behavior.

# Local Contracts

- Retain each navigation frame's UUI Model and context across refreshes and
  returns.
- Use cheap observed snapshots for lists and explicit targeted refreshes for
  live detail.
- Secret editing starts empty, writes through the typed API, and never loads the
  stored secret value.

# Work Guidance

- Keep source/version/Git operations in the kernel package API and service
  policy mutations in the shared services package API.

# Verification

- From the repository root, run `deno task check` and `deno task test`.

# Child DOX Index

- [layouts/AGENTS.md](layouts/AGENTS.md): Own declarative layouts for the shared
  administration screens.
