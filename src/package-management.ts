import { packageInfo } from "/p/the8020/packages/types/package.ts";
import {
  installedVersion,
  sourceInfo,
  sourceVersion,
} from "/p/the8020/packages/types/source.ts";
import { ScreenFrame } from "./screen_frame.ts";
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
  sendMessage,
  z,
} from "/p/the8020/uui/mod.ts";
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
    kind: sourceInfo.shape.kind,
    name: sourceInfo.shape.name,
    commit: sourceInfo.shape.commit,
  });
  return z.object({
    source: field(sourceInfo.shape.source, {
      length: "long",
      placeholder: "https://github.com/author/repository.git",
    }),
    author: field(packageInfo.shape.author, {
      length: "medium",
      readOnly: true,
      hidden: inspection === undefined,
    }),
    repository: field(packageInfo.shape.repository, {
      length: "medium",
      readOnly: true,
      hidden: inspection === undefined,
    }),
    defaultBranch: field(sourceInfo.shape.branch, {
      label: "Default branch",
      length: "medium",
      readOnly: true,
      hidden: inspection === undefined,
    }),
    version: field(sourceVersion(inspection), { length: "long" }),
    references: field(z.array(Reference), { hidden: true }),
  });
}

export const LocalPackage = z.object({
  author: field(packageInfo.shape.author, { length: "medium" }),
  repository: field(packageInfo.shape.repository, { length: "medium" }),
  description: field(packageInfo.shape.description, { length: "long" }),
});

function versionsSchema(versions: PackageVersions) {
  const Version = z.object({
    commit: sourceInfo.shape.commit,
    authoredAt: sourceInfo.shape.authoredAt,
    author: sourceInfo.shape.author,
    tags: sourceInfo.shape.tags,
    current: sourceInfo.shape.current,
    selected: sourceInfo.shape.selected,
    subject: sourceInfo.shape.subject,
  });
  return z.object({
    source: field(sourceInfo.shape.source, {
      label: "Git source",
      length: "long",
      readOnly: true,
    }),
    currentCommit: field(sourceInfo.shape.commit, {
      label: "Installed commit",
      length: "long",
      readOnly: true,
    }),
    selection: field(installedVersion(versions), {
      label: "Version to install",
      length: "long",
    }),
    versions: z.array(Version),
  });
}

export async function packageInstall(
  frame = new ScreenFrame(),
): Promise<ScreenResult> {
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
      description: "Enter a repository URL and choose the version to install.",
      schema: installSchema(inspection),
      model: frame.model(model),
      layout: packageInstallLayout,
      header: {
        actions: [
          { id: "detect", label: "Check repository" },
          { id: "save", label: "Save for later" },
          {
            id: "save-sync",
            label: "Install",
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
        sendMessage(`Detected ${inspection.package_id}`, "success");
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
          sendMessage(`Saved ${inspection.package_id}`, "success");
          continue;
        }
        const synchronized = await kernel.packages.synchronize([
          inspection.package_id,
        ]);
        requireSuccessfulSynchronization(synchronized);
        sendMessage(`Installed ${inspection.package_id}`, "success");
        return { view: "back" };
      }
    } catch (error) {
      sendMessage(
        errorMessage(error, "Package operation failed"),
        "error",
      );
    }
  }
}

export async function packageVersions(
  packageId: string,
  frame = new ScreenFrame(),
): Promise<ScreenResult> {
  let draft: string | undefined;
  while (true) {
    let index: PackageIndex;
    let versions: PackageVersions;
    try {
      [index, versions] = await Promise.all([
        kernel.packages.index.inspect(packageId),
        kernel.packages.versions.list(packageId, 100),
      ]);
    } catch (error) {
      sendMessage(errorMessage(error, "Version lookup failed"), "error");
      return { view: "back" };
    }
    if (index.local) {
      sendMessage(
        "Local packages do not have a remote version selector",
        "error",
      );
      return { view: "back" };
    }
    const model = {
      source: index.source ?? "",
      currentCommit: versions.current_commit ?? "",
      selection: draft ?? selectedVersion(index),
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
        "Choose a version from field help or select a row below, then apply it to the package.",
      schema: versionsSchema(versions),
      model: frame.model(model),
      layout: packageVersionsLayout,
      header: {
        actions: [
          { id: "refresh", label: "[[icon=refresh]] Refresh" },
          { id: "save", label: "Apply version", kind: "primary" },
        ],
      },
    });
    if (event.action === BACK_EVENT) return { view: "back" };
    if (event.action === "refresh") {
      draft = undefined;
      continue;
    }
    draft = model.selection;
    if (event.action === "select" && typeof event.value === "string") {
      draft = `commit:${event.value}`;
      continue;
    }
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
      sendMessage(`Synchronized ${packageId}`, "success");
      draft = undefined;
    } catch (error) {
      sendMessage(errorMessage(error, "Version update failed"), "error");
    }
  }
}

export async function packageLocal(
  frame = new ScreenFrame(),
): Promise<ScreenResult> {
  const model = { author: "", repository: "", description: "" };
  while (true) {
    const event = await callScreen({
      id: "core-admin-package-local",
      title: "Create local package",
      description: "Create a package for your own programs and services.",
      schema: LocalPackage,
      model: frame.model(model),
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
      sendMessage(`Created ${created.index.package_id}`, "success");
      return { view: "back" };
    } catch (error) {
      sendMessage(errorMessage(error, "Package creation failed"), "error");
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
