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
- Program layouts put its description and execution kind before the related
  package; source metadata is shown only in the program's Advanced screen.
- Package detail is a compact overview plus service/program lists. The advanced
  layout owns full manifest, Git, and file cards; empty main content lists are
  omitted by the screen.
- Install prioritizes URL and version; Versions prioritizes the selected version
  and readable changes. Their field help owns reference selection. Secret
  editing uses one field group for name and value without redundant section
  headings.
- Service overview contains Enabled, health, and running capacity. One settings
  layout contains Enabled, the Scaling section with Worker threads, Single
  worker, and Replication cards, plus lifecycle and execution identity. There is
  no Advanced configuration layout. Sandbox detail contains readable activity
  and linked services/Workers.
- Historical sandbox detail presents one bounded log page in a read-only
  multiline field. Its metadata list has no copied-log file/size columns.

# Work Guidance

- Use shell-owned Back navigation. Put primary/global actions in headers and
  relationship actions alongside their detail fields.

# Verification

- From the repository root, run `deno task check` and `deno task test`.

# Child DOX Index

No child DOX documents. This document owns the entire local scope.
