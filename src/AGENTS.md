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
- Programs lists description, execution kind, and package. Its main detail owns
  Execute and package navigation; Advanced owns source metadata and flags. Reuse
  the packages repository's semantic program/package fields.
- Use cheap observed snapshots for lists and explicit targeted refreshes for
  live detail.
- Package overview reads package inspection/index and indexed services. Keep
  Git, file inventory, and technical diagnostics in its separate Advanced
  navigation frame. Both main content lists open the related entity.
- Package detail owns the Delete package header action and confirmation modal.
  Call the typed deletion API only after confirmation, display errors on the
  detail, and return to the preceding screen after success.
- Package fields and bounded Git selectors come from `the8020/packages/types/`.
  Service policy comes from `the8020/services/types/service.ts`; runtime fields
  come from `../types/runtime.ts`. Screens customize placement and editability.
  Credentials use the secrets package's on-demand name-only lookup and its
  linked edit screen; opening Advanced never preloads credentials.
- Identifier fields retain semantic value help and navigation on their own
  detail screens as well as references. Read-only placement prevents editing,
  not inspecting or opening the entity.
- Services separate overview, settings, and diagnostics. Configuration keeps
  every editable setting, including Enabled, in one draft on one page, uses the
  original scaling groups, and calls the shared mutation API only on Save. Idle
  session timeout accepts `0s` under the shared service lifecycle contract.
- Sandbox and Worker screens use existing runtime snapshots and explicit
  relationships. Worker workload owners must never be treated as usernames.
- Worker rows and details reuse `runtimeInfo.workerState`; sandbox statuses use
  `runtimeInfo.state`, preserving their distinct value-help sets.
- Secret editing starts empty, writes through the typed API, and never loads the
  stored secret value.
- Sandbox history lists read metadata only. Details query the owning node's
  unified logs by saved position, sandbox ID and time range, retaining one page
  and cursor in their existing navigation frame. Render decoded stack traces
  with the shared SDK formatter and show expired, unavailable or partial pages
  explicitly without discarding terminal metadata.

# Work Guidance

- Compose related administration through owning public programs and shared
  semantic fields. New domain behavior belongs with its package; shared UUI
  defects belong in the framework, with the affected navigation flow verified.

- Runtime placement uses one sandbox identity alongside node and Worker IDs. Do
  not store or display a second identity for the same sandbox.

- Keep source/version/Git operations in the kernel package API and service
  policy mutations in the shared services package API.

# Verification

- From the repository root, run `deno task check` and `deno task test`.

# Child DOX Index

- [layouts/AGENTS.md](layouts/AGENTS.md): Own declarative layouts for the shared
  administration screens.
