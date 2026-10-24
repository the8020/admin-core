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
  package, secret, service, sandbox, and Worker administration entrypoints.
- [src/AGENTS.md](src/AGENTS.md): Implement shared administration screens,
  navigation, and typed result models.
- [types/AGENTS.md](types/AGENTS.md): Share runtime references, status,
  capacity, diagnostics, and archive fields.

# Purpose

- Provide first-party UUI programs for program, package, secret, service,
  sandbox, and Worker administration.
- This file is the root contract of the independent `the8020/admin-core` Git
  repository.

# Ownership

- `widgets/` declares this package's Home tiles and categories through the
  `the8020/packages/widgets.ts` format; tiles are visible with the view
  permission of what they show (`the8020.packages.package.view` for Packages and
  Programs, `the8020.secrets.secret.view`, `the8020.services.service.view`,
  `the8020.admin-core.sandbox.view`, `the8020.admin-core.worker.view`).
- Own linked package list/detail/install/version/local-create, named-secret
  list/edit, program list/detail, service overview/settings, live sandbox and
  Worker list/detail, and separate historical sandbox list/detail screens plus
  their typed command-result models.
- Do not own UUI-session administration, command behavior, authorization,
  runtime lifecycle, program discovery, or browser rendering.

# Local Contracts

- Kernel calls and Kernel logs are separate Home programs. `kernel.execute`
  (full key `the8020.admin-core.kernel.execute`, empty value) grants native CBus
  administration, including mutations and package commands executed as system;
  it is intentionally stronger than individual package permissions. Check it on
  entry and before every action. `the8020.admin-core.logs.view` checks the exact
  node before log reads or exports. Tiles use their respective declarations.
- Kernel calls uses the live catalog and native line parser through the Worker
  bridge, retaining only the latest 64 KiB result in an ordinary read-only
  textarea. Required native confirmation flags remain required. Secure-input
  commands are visible but rejected with guidance to native admin or dedicated
  screens; browser input never becomes a host secret-file path.
- Kernel logs uses one 100-record/256 KiB owner page at a time. Filters restart
  cursors; First, Recent, Next and Refresh use the same query API as history.
  Copy page and Save page export exactly the displayed page, including readable
  multiline text, through UUI clipboard/downloads. They do not export all pages.
  Unsubmitted filters do not change exports or the applied-node permission
  check. The status exposes recent-window limits, more results, unreadable
  records, expiration and unavailability. There is no additional log storage.

- Sandbox and Worker screens read kernel-owned data, so admin-core declares and
  checks `the8020.admin-core.sandbox.view` and `the8020.admin-core.worker.view`
  (value the sandbox, history or Worker ID, empty for lists) when each screen
  opens. `src/authorized.ts` turns such a denial into an error message and an
  ordinary Back instead of a terminated program.
- Service lists and details read through `the8020/services/src/admin.ts`
  (`listServices`, `inspectService`) so service view permissions apply.
- Package mutations use `the8020/packages/src/admin.ts`; service configuration
  and restarts use `the8020/services/src/admin.ts`. These application owners
  enforce authorization against the current user. Screens never substitute
  native mutation calls or system commands for these APIs.

- Administration programs open their catalogs without arguments. Packages and
  Programs, Secrets, Services, Sandboxes, and Workers also accept a selected
  identifier for semantic field clickthrough. Use typed kernel/package APIs and
  ordinary `/p/` imports.
- All interactive entrypoints declare `uui = true`. The
  `the8020/admin-core/programs` uses `the8020/packages/programs.ts` to display
  all ready programs, including hidden and non-UUI programs. Its retained list
  and detail models put the description, execution kind, and linked package
  first. Advanced owns program ID, entrypoint, commit, and Home/interactive
  flags. Program headings use the short program name. Execute calls the ordinary
  `/p/the8020/jobs/programs/run-program/program.ts` entrypoint with the selected
  ID; Jobs owns input collection, execution mode, and results. Back returns
  through the existing navigation frames, preserving list state.
- Program/package references reuse the fields owned by the packages repository.
  Program detail links directly to its package; shared help calls the selected
  entity's ordinary public UUI entrypoint.
- Programs use typed private kernel operations under the active authenticated
  request. Collections stay compact; details own full status and relationships.
  Service mutations call the shared Deno services-package configuration API in
  the existing Worker; the kernel exposes only observed runtime operations.
- Service catalogs show one row per logical service, its description, status,
  and unique sandbox/Worker totals across current and retained versions. Main
  detail puts health, address, access, package, and running capacity first.
  Enabled is visible in the overview. Configure edits all service policy on one
  page, including Enabled; Advanced shows version/snapshot diagnostics. Each
  live sandbox stays directly reachable.
- Package collection combines the generic package catalog with the accepted
  service index for service counts. Selecting one package combines generic
  package inspection with that package's indexed services. The main page shows
  status, description, available documentation/license, and compact service and
  program links. Empty content groups are omitted. Advanced owns Git inspection,
  repository controls, full manifest diagnostics, and bounded file inventory.
  Main-page refresh reads the desired index to offer remote Versions only when
  applicable; it never inspects Git or lists credentials. Kernel package records
  contain no service declarations or counts.
- Package list toolbar actions open ordinary Install package and Create local
  package screens. Install validates an HTTP or HTTPS Git URL, displays detected
  identity, writes the desired index, and may install in one action. Its
  optional authentication secret uses the shared secret-name field; the name is
  passed to source inspection and stored on the desired index, and a failed
  check without one suggests choosing it for a private repository. Versions
  lists readable changes/tags and accepts row or field-help selection before
  Apply version. The catalog's Fetch and Update act only on checkbox-selected
  packages, including ordinary Select all. Preserve selection between actions;
  skip repositories without remotes and finish with one counted notification.
  Fetch retains installed code; Update advances to the newest fetched numeric
  release tag, or the current remote branch when no release tags exist. Status
  icons show the last check, availability, local changes, and unavailable or
  failed checks. Branch/commit/tag choices use searchable help over bounded
  reference snapshots through `the8020/packages/types/source.ts`. Advanced
  retains fetch, push, and checkout. Once the repository is initialized it also
  edits the remote name and URL; Save remote requires a nonblank URL, defaults
  the name to `origin`, and calls the authorized packages repository API, which
  rejects embedded credentials. Its credential field reuses
  `the8020/secrets/types/secret.ts` and loads names only when help opens. Git
  operations remain typed kernel calls and refresh only affected services; the
  existing explicit desired-version synchronization action remains available.
- Secrets lists names and update times. Add/edit starts with a blank password
  field, never calls secret get, clears the submitted model value, and
  overwrites the named value through `the8020/secrets/mod.ts`. One field group
  owns name and replacement value. Shared secret-name help can open this screen
  from another entity and remains available on the secret's own name field.
- Package management screens use the authorized packages API backed by typed
  private kernel operations; they never read host paths or run Git.
- Package detail exposes Delete package with a modal naming the selected package
  and explaining retained database data. Confirmation calls the shared deletion
  API; cancellation and errors retain the detail, and success returns through
  ordinary Back navigation.
- Package detail also opens `the8020/deployments/deployments` with its package
  ID for an ad hoc version deployment and immutable run history.
- Detail headings identify `Package <id>`, `Service <short name>`,
  `Sandbox <id>`, or `Archived sandbox <id>`. Unboxed H1 sections contain
  second-level detail, list, or field-group cards.
- Package/service and package/program navigation are bidirectional. Sandbox
  details show correlated services but never discover or duplicate
  application-owned session state.
- Service configuration is one page with no nested Advanced view. Only Save
  settings writes Enabled and canonical policy through the services package;
  Back discards the draft. Scaling retains the Worker threads, Single worker,
  and Replication groups together; lifecycle and execution identity are on the
  same page. Diagnostics Advanced contains versions and runtime snapshots only.
  Zero minimum allows scale-to-zero, zero maximum means no service-level limit,
  and switching service type retains its session timeout. Execution identities
  can be entered directly; account sign-in eligibility never limits them.
- Sandbox overview shows health, work, total RAM and CPU time, services, and
  Workers. Advanced owns raw metrics, placement, IDs, and snapshot diagnostics.
  Worker lists/details show heap used and thread CPU time; service details sum
  all their live Workers, including draining versions. Program detail sums its
  ordinary running job Workers and links them. Resource samples are dated and
  remain transient; interactive UUI calls share their session service Worker.
  Worker detail uses the existing inspect API and links its sandbox and, for
  service workloads, its canonical owner service. A workload owner is not an
  execution username. Shared runtime reference fields live in
  `types/runtime.ts`.
- Every screen uses shell-owned `BACK_EVENT`; list refresh and paging belong in
  list toolbars; navigation, service-state, restart, and form save actions
  belong in screen headers.
- Live package, service, and sandbox collections and their selected details each
  expose a Refresh action in the owning list toolbar or detail header that
  reloads the current target without navigating.
- Service and sandbox lists plus ordinary service detail opening use cached
  observed runtime state. Sandbox detail samples the selected sandbox on entry
  and Refresh so memory is measured before its first display. Advanced detail
  shows snapshot revision/time; Refresh invokes the targeted live service or
  sandbox operation and never triggers a global runtime scan.
- Sandbox history is a bounded metadata collection. Opening a record reads
  bounded `kernel.logs` pages using its creation node, sandbox ID, time range
  and saved position. First/Recent/Next actions replace the displayed page;
  expired or unavailable logs leave the terminal metadata visible. Nullable
  collection results are treated as empty.

- Navigation history entries retain a UUI Model and program context, including
  the sandbox-history backend cursor. Refreshes replace business data without
  losing list query/page or viewport state. Layouts use declarative column
  widths and compact headings.

# Work Guidance

- Build only what the request and established contracts require. Before adding a
  mechanism, identify that need and why existing owners or standard tools cannot
  meet it. Do not invent stronger guarantees for hypothetical cases. Remove
  unsupported additions at closeout; agent-written tests and DOX do not
  authorize them. Preserve required correctness, security, and data integrity.

- Keep administration features within their owning domain and reuse its public
  program or mutation API. Package unrelated capabilities separately; a screen
  is not a new owner for service policy or runtime state.
- Reuse shared UUI models, semantic reference fields, and bounded owner
  snapshots. Fix a missing shared capability at its owner and verify the linked
  administration flow before considering a kernel change.

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

## UI Rules

- Do not add explanatory helper copy that restates what the control already
  implies (e.g. "optional", "works without selection", "failure falls back to
  X"). Prefer clear labels and option text; surface status in results when
  needed, not as instructional paragraphs under every field.
- Keep UI copy concise. Avoid tutorial-style descriptions unless the user
  explicitly asks for onboarding help.

# Verification

- `diagnostics_native_fixture.ts` runs through the sibling UUI native browser
  harness (`--fixture=../admin-core/diagnostics_native_fixture.ts`). It stages
  development helpers through the ordinary installer, verifies real catalog
  selection/dispatch, a harmless event mutation, native rejection, host log
  search/continuation, byte-exact browser page copy/download with pending
  filters, node authorization, and the installed sandbox helper/discovery plus
  token isolation. Use disposable runtime images with a current native smoke
  record and workspace resource limits.
- `src/diagnostics_test.ts` checks ordinary text controls, result replacement,
  errors, permission denial, filtered continuation/reset/refresh, multiline
  copy/download with unapplied filters, applied-node permission revocation,
  expiration and unavailable nodes. Native logging-owner tests cover rotation,
  retention and limits.

- Run package tasks inside an 80|20 Deno workspace; its root config supplies
  platform imports. The package config owns dependencies and tasks.

- `deno task check` formats, lints, and type-checks all programs;
  `deno task test` covers package summary/detail, source/version/Git selectors,
  remote editing, secret overwrite-without-read behavior, mapping, fractional
  utilization conversion, canonical scaling/lifecycle bindings, nullable
  Worker/history arrays, duration rendering, and current-target refresh behavior
  for all live collection/detail screens, including targeted refresh and
  snapshot freshness. The explicit browser E2E exercises navigation and service
  mutation.
- `package_updates_native_fixture.ts` runs through UUI's native browser harness
  with `--fixture=../admin-core/package_updates_native_fixture.ts`. It creates
  an isolated HTTP Git remote and verifies Select all, individual selection,
  retained selection, fetch without activation, exact release updates, no-remote
  skips, status icons, counts, and detail navigation. Follow workspace CPU,
  memory, runtime, and fresh numbered-instance limits.
