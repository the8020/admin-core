import {
  kernel,
  type PackageIndex,
  type PackageSourceInspection,
  type PackageSynchronization,
  type PackageVersions,
} from "@the8020/kernel";
import {
  BACK_EVENT,
  callScreen,
  field,
  showNotification,
  z,
} from "@packages/the8020/uui/mod.ts";
import packageInstallLayout from "./layouts/package-install.json" with {
  type: "json",
};
import packageLocalLayout from "./layouts/package-local.json" with {
  type: "json",
};
import packageVersionsLayout from "./layouts/package-versions.json" with {
  type: "json",
};
import type { ScreenResult } from "./navigation.ts";

interface InstallModel {
  source: string;
  author: string;
  repository: string;
  defaultBranch: string;
  version: string;
  references: Array<{
    referenceKey: string;
    kind: string;
    name: string;
    commit: string;
  }>;
}

export function installSchema(inspection?: PackageSourceInspection) {
  const Reference = z.object({
    referenceKey: z.string(),
    kind: z.string(),
    name: z.string(),
    commit: z.string(),
  });
  return z.object({
    source: field(z.string(), {
      label: "Git URL",
      length: "long",
      placeholder: "https://github.com/author/repository.git",
    }),
    author: field(z.string(), {
      label: "Author",
      length: "medium",
      readOnly: true,
    }),
    repository: field(z.string(), {
      label: "Repository",
      length: "medium",
      readOnly: true,
    }),
    defaultBranch: field(z.string(), {
      label: "Default branch",
      length: "medium",
      readOnly: true,
    }),
    version: field(z.string().min(1), {
      label: "Version",
      length: "long",
      control: "select",
      options: sourceVersionOptions(inspection),
    }),
    references: z.array(Reference),
  });
}

export const LocalPackage = z.object({
  author: field(z.string(), {
    label: "Author",
    length: "medium",
  }),
  repository: field(z.string(), {
    label: "Repository",
    length: "medium",
  }),
  description: field(z.string(), {
    label: "Description",
    length: "long",
  }),
});

function versionsSchema(versions: PackageVersions) {
  const Version = z.object({
    commit: z.string(),
    authoredAt: z.string(),
    author: z.string(),
    tags: z.string(),
    current: z.boolean(),
    selected: z.boolean(),
    subject: z.string(),
  });
  return z.object({
    source: field(z.string(), {
      label: "Git source",
      length: "long",
      readOnly: true,
    }),
    currentCommit: field(z.string(), {
      label: "Installed commit",
      length: "long",
      readOnly: true,
    }),
    selection: field(z.string().min(1), {
      label: "Desired version",
      length: "long",
      control: "select",
      options: installedVersionOptions(versions),
    }),
    versions: z.array(Version),
  });
}

export async function packageInstall(): Promise<ScreenResult> {
  const model: InstallModel = {
    source: "",
    author: "",
    repository: "",
    defaultBranch: "",
    version: "latest",
    references: [],
  };
  let inspection: PackageSourceInspection | undefined;
  while (true) {
    const event = await callScreen({
      id: "core-admin-package-install",
      title: "Install package",
      description:
        "Inspect a public HTTPS Git repository, save it to the package index, and optionally synchronize it now.",
      schema: installSchema(inspection),
      model,
      layout: packageInstallLayout,
      header: {
        actions: [
          { id: "detect", label: "Detect" },
          { id: "save", label: "Save" },
          {
            id: "save-sync",
            label: "Save & synchronize",
            kind: "primary",
          },
        ],
      },
    });
    if (event.action === BACK_EVENT) return { view: "back" };
    try {
      if (event.action === "detect") {
        model.source = requiredText(model.source, "Git URL");
        inspection = await kernel.packages.source.inspect(model.source);
        applyInspection(model, inspection);
        showNotification(`Detected ${inspection.package_id}`, "success");
        continue;
      }
      if (event.action === "save" || event.action === "save-sync") {
        model.source = requiredText(model.source, "Git URL");
        if (
          inspection === undefined ||
          inspection.source !== normalizedURL(model.source)
        ) {
          inspection = await kernel.packages.source.inspect(model.source);
          applyInspection(model, inspection);
        }
        const selected = desiredVersion(model.version);
        await kernel.packages.index.set({
          author: inspection.author,
          repository: inspection.repository,
          source: inspection.source,
          ...selected,
        });
        if (event.action === "save") {
          showNotification(`Saved ${inspection.package_id}`, "success");
          continue;
        }
        const synchronized = await kernel.packages.synchronize([
          inspection.package_id,
        ]);
        requireSuccessfulSynchronization(synchronized);
        showNotification(`Installed ${inspection.package_id}`, "success");
        return { view: "back" };
      }
    } catch (error) {
      showNotification(
        errorMessage(error, "Package operation failed"),
        "error",
      );
    }
  }
}

export async function packageVersions(
  packageId: string,
): Promise<ScreenResult> {
  while (true) {
    let index: PackageIndex;
    let versions: PackageVersions;
    try {
      [index, versions] = await Promise.all([
        kernel.packages.index.inspect(packageId),
        kernel.packages.versions.list(packageId, 100),
      ]);
    } catch (error) {
      showNotification(errorMessage(error, "Version lookup failed"), "error");
      return { view: "back" };
    }
    if (index.local) {
      showNotification(
        "Local packages do not have a remote version selector",
        "error",
      );
      return { view: "back" };
    }
    const model = {
      source: index.source ?? "",
      currentCommit: versions.current_commit ?? "",
      selection: selectedVersion(index),
      versions: versions.versions.map((version) => ({
        commit: version.commit,
        authoredAt: version.authored_at,
        author: version.author,
        tags: version.tags.join(", "),
        current: version.current,
        selected: version.selected,
        subject: version.subject,
      })),
    };
    const event = await callScreen({
      id: "core-admin-package-versions",
      title: `Versions for ${packageId}`,
      description:
        "Select latest, a tag, or an exact commit. Saving synchronizes the package and refreshes its services.",
      schema: versionsSchema(versions),
      model,
      layout: packageVersionsLayout,
      header: {
        actions: [
          { id: "refresh", label: "[[icon=refresh]] Refresh" },
          { id: "save", label: "Save & synchronize", kind: "primary" },
        ],
      },
    });
    if (event.action === BACK_EVENT) return { view: "back" };
    if (event.action === "refresh") continue;
    if (event.action !== "save") continue;
    try {
      const selected = desiredVersion(model.selection);
      await kernel.packages.index.set({
        author: index.author,
        repository: index.repository,
        source: index.source,
        secret: index.secret,
        ...selected,
      });
      const synchronized = await kernel.packages.synchronize([packageId]);
      requireSuccessfulSynchronization(synchronized);
      showNotification(`Synchronized ${packageId}`, "success");
    } catch (error) {
      showNotification(errorMessage(error, "Version update failed"), "error");
    }
  }
}

export async function packageLocal(): Promise<ScreenResult> {
  const model = { author: "", repository: "", description: "" };
  while (true) {
    const event = await callScreen({
      id: "core-admin-package-local",
      title: "Create local package",
      description:
        "Create an independent local Git repository with a package manifest and no remote source.",
      schema: LocalPackage,
      model,
      layout: packageLocalLayout,
      header: {
        actions: [{ id: "create", label: "Create", kind: "primary" }],
      },
    });
    if (event.action === BACK_EVENT) return { view: "back" };
    if (event.action !== "create") continue;
    try {
      const created = await kernel.packages.local.create({
        author: requiredText(model.author, "Author"),
        repository: requiredText(model.repository, "Repository"),
        description: model.description,
      });
      showNotification(`Created ${created.index.package_id}`, "success");
      return { view: "back" };
    } catch (error) {
      showNotification(errorMessage(error, "Package creation failed"), "error");
    }
  }
}

export function desiredVersion(
  selection: string,
): { commit?: string; tag?: string } {
  if (selection === "latest") return {};
  if (selection.startsWith("tag:") && selection.length > 4) {
    return { tag: selection.slice(4) };
  }
  if (selection.startsWith("commit:") && selection.length > 7) {
    return { commit: selection.slice(7) };
  }
  throw new TypeError("Select latest, a tag, or an exact commit");
}

export function requiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized === "") throw new TypeError(`${label} is required`);
  return normalized;
}

export function sourceVersionOptions(inspection?: PackageSourceInspection) {
  const options = [{ value: "latest", label: "Latest default branch" }];
  if (inspection === undefined) return options;
  const seen = new Set<string>(["latest"]);
  for (const reference of inspection.references) {
    const value = reference.kind === "tag"
      ? `tag:${reference.name}`
      : `commit:${reference.commit}`;
    if (seen.has(value)) continue;
    seen.add(value);
    options.push({
      value,
      label: reference.kind === "tag"
        ? `Tag ${reference.name}`
        : `${reference.name} (${reference.commit.slice(0, 12)})`,
    });
  }
  return options;
}

function installedVersionOptions(versions: PackageVersions) {
  const options = [{ value: "latest", label: "Latest default branch" }];
  for (const version of versions.versions) {
    for (const tag of version.tags) {
      options.push({ value: `tag:${tag}`, label: `Tag ${tag}` });
    }
    options.push({
      value: `commit:${version.commit}`,
      label: `${version.short_commit} — ${version.subject}`,
    });
  }
  return options;
}

function selectedVersion(index: PackageIndex): string {
  if (index.tag !== undefined && index.tag !== "") return `tag:${index.tag}`;
  if (index.commit !== undefined && index.commit !== "") {
    return `commit:${index.commit}`;
  }
  return "latest";
}

function applyInspection(
  model: InstallModel,
  inspection: PackageSourceInspection,
): void {
  model.source = inspection.source;
  model.author = inspection.author;
  model.repository = inspection.repository;
  model.defaultBranch = inspection.default_branch ?? "";
  model.version = "latest";
  model.references = inspection.references.map((reference) => ({
    referenceKey: `${reference.kind}:${reference.name}`,
    ...reference,
  }));
}

function normalizedURL(source: string): string {
  const trimmed = source.trim().replace(/\/$/, "");
  return trimmed.endsWith(".git") ? trimmed : `${trimmed}.git`;
}

function requireSuccessfulSynchronization(
  results: PackageSynchronization[],
): void {
  const failed = results.find((result) => !result.success);
  if (failed !== undefined) {
    throw new Error(`Could not synchronize ${failed.package_id}`);
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
