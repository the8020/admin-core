# Purpose

- Provide first-party UUI programs for kernel service and sandbox
  administration.

# Ownership

- Own the linked service list/detail and sandbox list/detail screens and their
  typed command-result models.
- Do not own command behavior, authorization, runtime lifecycle, program
  discovery, or browser rendering.

# Local Contracts

- `core/admin/services` and `core/admin/sandboxes` are parameterless entry
  programs backed only by `@platform/kernel` and `@platform/uui`.
- Programs execute the existing typed kernel command bus; only a
  kernel-authenticated bootstrap administrator may cross that boundary.
- Collection screens remain compact and clickable. Detail screens own full
  status, relationships, and service configuration mutations.
- Service and sandbox detail navigation is bidirectional and uses ordinary
  TypeScript calls without injected infrastructure dependencies.
- Command-result array fields are treated defensively because older or empty Go
  slices may arrive as `null`; collection counts remain readable as zero.

# Work Guidance

- Keep labels short, lists bounded to useful columns, and program code free of
  explanatory filler.

# Verification

- `view_test.ts` covers command-result mapping, nullable empty Worker IDs, and
  duration rendering; repository installation type-checks both program
  entrypoints and the real browser E2E exercises authorized list/detail
  navigation and service mutation.

# Child DOX Index
