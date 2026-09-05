Parent DOX: [8020 workspace](../AGENTS.md).

Framework source:
[agent0ai/dox/AGENTS.md](https://github.com/agent0ai/dox/blob/765ae4ac02cc884eefcd41a3d0f71941721adb89/AGENTS.md).

# DOX framework

- DOX is highly performant AGENTS.md hierarchy installed here
- Agent must follow DOX instructions across any edits

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable
  docs must stay understandable from the nearest applicable AGENTS.md plus every
  parent AGENTS.md above it

## Read Before Editing

1. Read the root AGENTS.md
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path,
   read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide
   rules
7. If docs conflict, the closer doc controls local work details, but no child
   doc may weaken DOX

Do not rely on memory. Re-read the applicable DOX chain in the current session
before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:

- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or
  quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child
index changes. Update child docs when parent changes alter local rules. Remove
stale or contradictory text immediately. Small edits that do not change behavior
or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy

- Root AGENTS.md is the DOX rail: project-wide instructions, global preferences,
  durable workflow rules, and the top-level Child DOX Index
- Child AGENTS.md files own domain-specific instructions and their own Child DOX
  Index
- Each parent explains what its direct children cover and what stays owned by
  the parent
- The closer a doc is to the work, the more specific and practical it must be

## Child Doc Shape

- Create a child AGENTS.md when a folder becomes a durable boundary with its own
  purpose, rules, responsibilities, workflow, materials, or quality standards
- Work Guidance must reflect the current standards of the project or user
  instructions; if there are no specific standards or instructions yet, leave it
  empty
- Verification must reflect an existing check; if no verification framework
  exists yet, leave it empty and update it when one exists

Default section order:

- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

## Style

- Keep docs concise, current, and operational
- Document stable contracts, not diary entries
- Put broad rules in parent docs and concrete details in child docs
- Prefer direct bullets with explicit names
- Do not duplicate rules across many files unless each scope needs a local
  version
- Delete stale notes instead of explaining history
- Trim obvious statements, repeated rules, misplaced detail, and warnings for
  risks that no longer exist

## Closeout

1. Re-check changed paths against the DOX chain
2. Update nearest owning docs and any affected parents or children
3. Refresh every affected Child DOX Index
4. Remove stale or contradictory text
5. Run existing verification when relevant
6. Report any docs intentionally left unchanged and why

## User Preferences

When the user requests a durable behavior change, record it here or in the
relevant child AGENTS.md

## Child DOX Index

This root retains repository-wide contracts and files outside the child scopes
below.

- [programs/AGENTS.md](programs/AGENTS.md): Expose the first-party program,
  package, secret, service, and sandbox administration entrypoints.
- [src/AGENTS.md](src/AGENTS.md): Implement shared administration screens,
  navigation, and typed result models.

# Purpose

- Provide first-party UUI programs for program, package, service, and sandbox
  administration.
- This file is the root contract of the independent `the8020/admin-core` Git
  repository.

# Ownership

- Own linked package list/detail/install/version/local-create, named-secret
  list/edit, program list/detail, service list/detail, live sandbox list/detail,
  and separate historical sandbox list/detail screens plus their typed
  command-result models.
- Do not own UUI-session administration, command behavior, authorization,
  runtime lifecycle, program discovery, or browser rendering.

# Local Contracts

- `the8020/admin-core/packages`, `the8020/admin-core/secrets`,
  `the8020/admin-core/services`, and `the8020/admin-core/sandboxes` are
  parameterless programs backed only by `@the8020/kernel` and the ordinary
  package mapping `/p/the8020/uui/mod.ts`.
- All interactive entrypoints declare `uui = true`. The parameterless
  `the8020/admin-core/programs` uses `kernel.programs.list()` to display all
  ready programs, including hidden and non-UUI programs. Its retained list and
  detail models expose UUI/discoverable flags, package, description, entrypoint,
  and commit. Execute calls the ordinary
  `/p/the8020/jobs/programs/run-program/program.ts` entrypoint with the selected
  ID; Jobs owns input collection, execution mode, and results. Back returns
  through the existing navigation frames, preserving list state.
- Programs use typed private kernel operations under the active authenticated
  request. Collections stay compact; details own full status and relationships.
  Service mutations call the shared Deno services-package configuration API in
  the existing Worker; the kernel exposes only observed runtime operations.
- The service collection keeps exactly one row per logical service and shows
  live version count plus unique sandbox and Worker totals across current and
  retained versions. Service detail lists every live sandbox once with its
  service version so retained session capacity remains directly inspectable.
- Package collection combines the generic package catalog with the accepted
  service index for service counts. Selecting one package combines generic
  package/repository inspection with that package's indexed services; only the
  detail path reads Git status, package manifests, and bounded non-Git file
  inventory. Kernel package records contain no service declarations or counts.
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
- Package management screens call the typed `kernel.packages` API backed by
  private kernel operations; they never read host paths or run Git.
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
  The lifecycle group also edits the anonymous execution user. It reads/writes
  canonical service execution policy, without assuming that the user is system.
  No active control writes legacy instance or replica fields.
- Every screen uses shell-owned `BACK_EVENT`; refresh, history, paging,
  service-state, restart, and save actions belong in the header.
- Live package, service, and sandbox collections and their selected details each
  expose a header Refresh action that reloads the current target without
  navigating.
- Service and sandbox lists plus ordinary detail opening use cached observed
  runtime state. Detail shows snapshot revision/time; its Refresh action invokes
  the targeted live service or sandbox operation and never triggers a global
  runtime scan.
- Sandbox history is a bounded separate collection with direct immutable
  metadata/log inspection. Nullable array results are treated as empty.

- Navigation history entries retain a UUI Model and program context, including
  the sandbox-history backend cursor. Refreshes replace business data without
  losing list query/page or viewport state. Layouts use declarative column
  widths and compact headings.

# Work Guidance

- Keep labels short, lists bounded to useful columns, and program code free of
  application-specific runtime assumptions.
- User-visible descriptions, hints, placeholders, notices, and empty-state copy
  must help the user act or understand a user-visible outcome. Never add copy
  solely to explain internal architecture, storage, persistence, sessions,
  transport, or implementation details; omit it entirely and keep those details
  in DOX or developer documentation. For example, never show
  `Value is stored per-session in the user storage.` or
  `The value is sent directly to kernel secret storage and is not shown again.`
  in the UI.
- Source checks resolve the sibling `kernel` and `uui` repositories; deployed
  Workers continue to resolve the canonical `@the8020/*` and `/p/*` mappings
  supplied by the runtime image.

# Verification

- `deno task check` formats, lints, and type-checks all programs;
  `deno task test` covers package summary/detail, source/version/Git selectors,
  secret overwrite-without-read behavior, mapping, fractional utilization
  conversion, canonical scaling/lifecycle bindings, nullable Worker/history
  arrays, duration rendering, and current-target refresh behavior for all live
  collection/detail screens, including targeted refresh and snapshot freshness.
  The explicit browser E2E exercises navigation and service mutation.
