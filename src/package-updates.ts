import { msg } from "/p/the8020/admin-core/i18n/messages.ts";
import type { PackageRepository, PackageVersions } from "@the8020/kernel";
import { getSystemProfile } from "/p/the8020/system/profile.ts";
import { packages } from "/p/the8020/packages/src/admin.ts";
import { choiceHelp, field } from "/p/the8020/db/fields.ts";
import { sourceInfo } from "/p/the8020/packages/types/source.ts";

export const updateLabels = {
  unchecked: msg("package_updates.unchecked"),
  unavailable: msg("package_updates.unavailable"),
  current: msg("package_updates.current"),
  available: msg("package_updates.available"),
  modified: msg("package_updates.modified"),
  blocked: msg("package_updates.blocked"),
  failed: msg("package_updates.failed"),
} as const;

export const packageUpdateField = field(sourceInfo.shape.repositoryStatus, {
  label: msg("package_updates.updates"),
  valueHelp: choiceHelp(
    sourceInfo.shape.repositoryStatus,
    Object.values(updateLabels),
  ),
});

export interface PackageUpdate {
  state: keyof typeof updateLabels;
  current?: string;
  currentTag?: string;
  target?: string;
  targetTag?: string;
}

export function updateState(
  repository: PackageRepository,
  checked?: PackageUpdate,
  hasSource = Boolean(repository.remote_url && repository.remote_name),
): PackageUpdate {
  if (!hasSource) {
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

export function availableUpdate(versions: PackageVersions): PackageUpdate {
  const current = versions.current_commit;
  if (!current) return { state: "blocked" };
  const target = versions.update_commit || current;
  const currentTag = versions.versions.find((item) => item.commit === current)
    ?.tags[0];
  const targetTag = current === target
    ? currentTag
    : versions.versions.find((item) => item.commit === target)?.tags[0];
  return {
    current,
    target,
    ...(currentTag ? { currentTag } : {}),
    ...(targetTag ? { targetTag } : {}),
    state: current === target ? "current" : "available",
  };
}

export async function fetchPackageUpdate(
  packageId: string,
): Promise<PackageUpdate> {
  const repository = await packages.repository.inspect(packageId);
  if (
    !repository.activation_ready ||
    (!repository.remote_url &&
      (await getSystemProfile()).role === "development")
  ) {
    return updateState(repository);
  }
  const result = availableUpdate(await packages.versions.list(packageId, 1000));
  return repository.clean ? result : { ...result, state: "modified" };
}

export async function applyPackageUpdate(
  packageId: string,
  checked?: PackageUpdate,
): Promise<"updated" | "current" | "skipped"> {
  const repository = await packages.repository.inspect(packageId);
  const status = updateState(
    repository,
    checked,
    Boolean(
      repository.remote_url ||
        (checked?.target && (await getSystemProfile()).role !== "development"),
    ),
  );
  if (status.state === "current") return "current";
  if (status.state !== "available" || !status.target) return "skipped";
  // Native checkout preserves local work and uses the already-fetched exact commit.
  await packages.repository.checkout({ packageId, commit: status.target });
  return "updated";
}
