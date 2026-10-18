import type { PackageRepository, PackageVersions } from "@the8020/kernel";
import { packages } from "/p/the8020/packages/src/admin.ts";
import { choiceHelp, field } from "/p/the8020/db/fields.ts";
import { sourceInfo } from "/p/the8020/packages/types/source.ts";

export const updateLabels = {
  unchecked: "[[icon=help color=muted]] Not checked",
  unavailable: "[[icon=cloud_off color=muted]] No remote",
  current: "[[icon=check_circle color=success]] Up to date",
  available: "[[icon=upgrade color=info]] Update available",
  modified: "[[icon=edit color=warning]] Local changes",
  blocked: "[[icon=warning color=warning]] Needs review",
  failed: "[[icon=error color=danger]] Check failed",
} as const;

export const packageUpdateField = field(sourceInfo.shape.repositoryStatus, {
  label: "Updates",
  description:
    "Availability from the last Fetch in this list. Update applies the newest fetched release tag, or the current remote branch when there are no release tags. Local changes and histories that cannot be safely advanced are skipped.",
  valueHelp: choiceHelp(
    sourceInfo.shape.repositoryStatus,
    Object.values(updateLabels),
  ),
});

export interface PackageUpdate {
  state: keyof typeof updateLabels;
  current?: string;
  target?: string;
  tag?: string;
}

export function updateState(
  repository: PackageRepository,
  checked?: PackageUpdate,
): PackageUpdate {
  if (!repository.remote_url || !repository.remote_name) {
    return { state: "unavailable" };
  }
  if (!repository.activation_ready) return { state: "blocked" };
  if (!repository.clean) return { ...checked, state: "modified" };
  if (checked?.state === "failed") return checked;
  if (checked?.target && checked.target === repository.head) {
    return { ...checked, state: "current" };
  }
  if (checked?.current !== repository.head) return { state: "unchecked" };
  return checked ?? { state: "unchecked" };
}

function release(tag: string): bigint[] | undefined {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(tag);
  return match?.slice(1).map(BigInt);
}

function compareRelease(left: string, right: string): number {
  const a = release(left)!, b = release(right)!;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i]! > b[i]! ? 1 : -1;
  }
  return 0;
}

/** Only advance when the bounded fetched history proves a fast-forward. */
export function availableUpdate(
  versions: PackageVersions,
  branchCommit?: string,
): PackageUpdate {
  const current = versions.current_commit;
  const releases = versions.versions.flatMap((version) =>
    version.tags
      .filter((tag) => release(tag) !== undefined)
      .map((tag) => ({ tag, commit: version.commit }))
  )
    .sort((a, b) => compareRelease(b.tag, a.tag));
  const newest = releases[0];
  const target = newest?.commit ?? branchCommit;
  const result = { current, target, tag: newest?.tag };
  if (!current || !target) return { ...result, state: "blocked" };
  if (target === current) return { ...result, state: "current" };
  const parents = new Map(
    versions.versions.map((version) => [version.commit, version.parents]),
  );
  const ancestor = (from: string, to: string) => {
    const pending = [to], visited = new Set<string>();
    while (pending.length) {
      const commit = pending.pop()!;
      if (commit === from) return true;
      if (visited.has(commit)) continue;
      visited.add(commit);
      pending.push(...parents.get(commit) ?? []);
    }
    return false;
  };
  if (ancestor(current, target)) return { ...result, state: "available" };
  if (ancestor(target, current)) return { ...result, state: "current" };
  return { ...result, state: "blocked" };
}

export async function fetchPackageUpdate(
  packageId: string,
): Promise<PackageUpdate> {
  const repository = await packages.repository.inspect(packageId);
  const initial = updateState(repository);
  if (initial.state === "unavailable" || !repository.activation_ready) {
    return initial;
  }
  await packages.repository.fetch(packageId);
  const versions = await packages.versions.list(packageId, 1000);
  let branchCommit: string | undefined;
  if (
    !versions.versions.some((version) =>
      version.tags.some((tag) => release(tag))
    )
  ) {
    const index = await packages.index.inspect(packageId);
    const source = await packages.source.inspect(repository.remote_url!, {
      secret: index.secret,
    });
    branchCommit = source.references.find((reference) =>
      reference.kind === "branch" &&
      reference.name === (repository.branch || source.default_branch)
    )?.commit;
  }
  return availableUpdate(versions, branchCommit);
}

export async function applyPackageUpdate(
  packageId: string,
  checked?: PackageUpdate,
): Promise<"updated" | "current" | "skipped"> {
  const repository = await packages.repository.inspect(packageId);
  const status = updateState(repository, checked);
  if (status.state === "current") return "current";
  if (status.state !== "available" || !status.target) return "skipped";
  const index = await packages.index.inspect(packageId);
  // Native checkout preserves local work and uses the already-fetched exact commit.
  await packages.repository.checkout({ packageId, commit: status.target });
  if (!index.local) {
    await packages.index.set({
      author: index.author,
      repository: index.repository,
      source: index.source,
      secret: index.secret,
      ...(status.tag ? { tag: status.tag } : { commit: status.target }),
    });
  }
  return "updated";
}
