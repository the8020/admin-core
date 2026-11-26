Parent DOX: [admin-core DOX](../AGENTS.md).

# Purpose

- Store the interactive Program dumps archive.

# Ownership

- `program_dumps.ts` defines the archive table and shared search/result fields.

# Local Contracts

- Search uses the captured username, canonical program ID, and UTC occurrence
  time. Keep the rendered heading and complete bounded short-dump text as
  captured. Archive detail reads the text without parsing a particular version
  of the exception format.
- Lists read metadata in bounded, newest-first pages. The full report is read
  only after opening a result. Retain historical usernames and program IDs when
  the corresponding accounts or programs are removed.

# Work Guidance

# Verification

- Run the package checks and the Program dumps native browser fixture.

# Child DOX Index

No child DOX documents. This document owns the entire local scope.
