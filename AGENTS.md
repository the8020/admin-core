# Purpose

- Provide first-party UUI programs for package, filesystem-service, and sandbox
  administration.
- This file is the root contract of the independent `the8020/admin-core` Git
  repository.

# Ownership

- Own linked package list/detail/install/version/local-create, named-secret
  list/edit, service list/detail, live sandbox list/detail, and separate
  historical sandbox list/detail screens plus their typed command-result models.
- Do not own UUI-session administration, command behavior, authorization,
  runtime lifecycle, program discovery, or browser rendering.

# Local Contracts

- `the8020/admin-core/packages`, `the8020/admin-core/secrets`,
  `the8020/admin-core/services`, and `the8020/admin-core/sandboxes` are
  parameterless programs backed only by `@the8020/kernel` and the ordinary
  package mapping `@packages/the8020/uui/mod.ts`.
- Programs use the typed kernel command bus under the active authenticated
  request. Collections stay compact; details own full status, relationships, and
  service configuration mutations.
- The service collection keeps exactly one row per logical service and shows
  live version count plus unique sandbox and Worker totals across current and
  retained versions. Service detail lists every live sandbox once with its
  service version so retained session capacity remains directly inspectable.
- Package collection calls only `package.list`. Selecting one package calls
  `package.inspect` and `package.repository.inspect`; only that detail path
  reads Git status, manifests, and bounded non-Git file inventory.
- Package list header actions open ordinary Install package and Create local
  package screens. Install validates an HTTPS Git URL, displays detected
  identity/branch/tag refs, writes the desired index, and may synchronize in one
  action. Versions lists bounded commits/tags and saves latest, tag, or exact
  commit before synchronization. Package detail exposes bounded branch/commit
  selectors plus pull, push, checkout, and stored-secret-name selection. Git
  operations remain typed kernel calls and refresh only affected services; the
  existing explicit desired-version synchronization action remains available.
- Secrets lists names and update times. Add/edit starts with a blank password
  field, never calls secret get, clears the submitted model value, and
  overwrites the named value through the typed kernel API.
- Management screens call the typed `kernel.packages` API, which delegates to
  generic command-bus execution; they never read host paths or run Git.
- Detail headings identify `Package <id>`, `Service <id>`, `Sandbox <id>`, or
  `Archived sandbox <id>`. Unboxed H1 sections contain second-level detail,
  list, or field-group cards.
- Package/service navigation is bidirectional. Sandbox details show correlated
  services but never discover or duplicate application-owned session state.
- Service detail exposes one canonical editable policy. `Scaling` contains
  `Worker threads` (minimum/maximum Workers), `Single worker` (concurrency,
  target utilization, and Worker keepalive), and `Replication` (sandbox group,
  minimum sandboxes, and Workers per sandbox). A separate `Lifecycle` group
  edits stateless/session type and session keepalive. Zero minimum means
  scale-to-zero; zero maximum means service-level unlimited. Session-only input
  is disabled while stateless but preserved so switching type remains editable.
  No active control writes legacy instance or replica fields.
- Every screen uses shell-owned `BACK_EVENT`; refresh, history, paging,
  service-state, restart, and save actions belong in the header.
- Live package, service, and sandbox collections and their selected details each
  expose a header Refresh action that reloads the current target without
  navigating.
- Sandbox history is a bounded separate collection with direct immutable
  metadata/log inspection. Nullable array results are treated as empty.

# Work Guidance

- Keep labels short, lists bounded to useful columns, and program code free of
  application-specific runtime assumptions.
- Source checks resolve the sibling `kernel` and `uui` repositories; deployed
  Workers continue to resolve the canonical `@the8020/*` and `@packages/*`
  mappings supplied by the runtime image.

# Verification

- `deno task check` formats, lints, and type-checks all programs;
  `deno task test` covers package summary/detail, source/version/Git selectors,
  secret overwrite-without-read behavior, mapping, fractional utilization
  conversion, canonical scaling/lifecycle bindings, nullable Worker/history
  arrays, duration rendering, and current-target refresh behavior for all live
  collection/detail screens. The explicit browser E2E exercises navigation and
  service mutation.

# Child DOX Index
