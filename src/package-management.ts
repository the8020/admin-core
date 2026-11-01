import { text as localizedText } from "/p/the8020/i18n/mod.ts";
import { msg } from "/p/the8020/admin-core/i18n/messages.ts";
import { packages } from "/p/the8020/packages/src/admin.ts";
import { packageInfo } from "/p/the8020/packages/types/package.ts";
import {
  installedVersion,
  sourceInfo,
  sourceVersion,
} from "/p/the8020/packages/types/source.ts";
import { ScreenFrame } from "./screen_frame.ts";
import {
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
  secretName: string;
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
      placeholder: msg(
        "package_management.https_github_com_author_repository_git",
      ),
    }),
    secretName: field(sourceInfo.shape.secretName, { length: "long" }),
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
      label: msg("package_management.default_branch"),
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
      label: msg("package_management.git_source"),
      length: "long",
      readOnly: true,
    }),
    currentCommit: field(sourceInfo.shape.commit, {
      label: msg("package_management.installed_commit"),
      length: "long",
      readOnly: true,
    }),
    selection: field(installedVersion(versions), {
      label: msg("package_management.version_to_install"),
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
    secretName: "",
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
      title: msg("package_management.install_package"),
      description: msg(
        "package_management.enter_a_repository_url_and_choose_the",
      ),
      schema: installSchema(inspection),
      model: frame.model(model),
      layout: packageInstallLayout,
      header: {
        actions: [
          { id: "detect", label: msg("package_management.check_repository") },
          { id: "save", label: msg("package_management.save_for_later") },
          {
            id: "save-sync",
            label: msg("package_management.install"),
            kind: "primary",
          },
        ],
      },
    });
    if (event.action === BACK_EVENT) return { view: "back" };
    try {
      if (event.action === "detect") {
        model.source = requiredText(model.source, "Git URL");
        inspection = await inspectSource(model);
        applyInspection(model, inspection);
        sendMessage(
          localizedText(
            msg("package_management.detected_value1", {
              value1: inspection.package_id,
            }),
          ),
          "success",
        );
        continue;
      }
      if (event.action === "save" || event.action === "save-sync") {
        model.source = requiredText(model.source, "Git URL");
        if (
          inspection === undefined ||
          inspection.source !== normalizedURL(model.source)
        ) {
          inspection = await inspectSource(model);
          applyInspection(model, inspection);
        }
        const selected = desiredVersion(model.version);
        const secret = model.secretName.trim();
        await packages.index.set({
          author: inspection.author,
          repository: inspection.repository,
          source: inspection.source,
          ...selected,
          ...(secret === "" ? {} : { secret }),
        });
        if (event.action === "save") {
          sendMessage(
            localizedText(
              msg("package_management.saved_value1", {
                value1: inspection.package_id,
              }),
            ),
            "success",
          );
          continue;
        }
        const synchronized = await packages.synchronize([
          inspection.package_id,
        ]);
        requireSuccessfulSynchronization(synchronized);
        sendMessage(
          localizedText(
            msg("package_management.installed_value1", {
              value1: inspection.package_id,
            }),
          ),
          "success",
        );
        return { view: "back" };
      }
    } catch (error) {
      sendMessage(
        errorMessage(
          error,
          localizedText(msg("package_management.package_operation_failed")),
        ),
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
        packages.index.inspect(packageId),
        packages.versions.list(packageId, 100),
      ]);
    } catch (error) {
      sendMessage(
        errorMessage(
          error,
          localizedText(msg("package_management.version_lookup_failed")),
        ),
        "error",
      );
      return { view: "back" };
    }
    if (index.local) {
      sendMessage(
        localizedText(
          msg("package_management.local_packages_do_not_have_a_remote"),
        ),
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
      title: msg("package_management.versions_for_packageid", {
        packageId: packageId,
      }),
      description: msg(
        "package_management.choose_a_version_from_field_help_or",
      ),
      schema: versionsSchema(versions),
      model: frame.model(model),
      layout: packageVersionsLayout,
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
      await packages.index.set({
        author: index.author,
        repository: index.repository,
        source: index.source,
        secret: index.secret,
        ...selected,
      });
      const synchronized = await packages.synchronize([packageId]);
      requireSuccessfulSynchronization(synchronized);
      sendMessage(
        localizedText(
          msg("package_management.synchronized_packageid", {
            packageId: packageId,
          }),
        ),
        "success",
      );
      draft = undefined;
    } catch (error) {
      sendMessage(
        errorMessage(
          error,
          localizedText(msg("package_management.version_update_failed")),
        ),
        "error",
      );
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
      title: msg("package_management.create_local_package"),
      description: msg(
        "package_management.create_a_package_for_your_own_programs",
      ),
      schema: LocalPackage,
      model: frame.model(model),
      layout: packageLocalLayout,
      header: {
        actions: [{
          id: "create",
          label: msg("package_management.create"),
          kind: "primary",
        }],
      },
    });
    if (event.action === BACK_EVENT) return { view: "back" };
    if (event.action !== "create") continue;
    try {
      const created = await packages.local.create({
        author: requiredText(model.author, "Author"),
        repository: requiredText(model.repository, "Repository"),
        description: model.description,
      });
      sendMessage(
        localizedText(
          msg("package_management.created_value1", {
            value1: created.index.package_id,
          }),
        ),
        "success",
      );
      return { view: "back" };
    } catch (error) {
      sendMessage(
        errorMessage(
          error,
          localizedText(msg("package_management.package_creation_failed")),
        ),
        "error",
      );
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
  throw new TypeError(
    localizedText(msg("ui.select_latest_a_tag_or_an_exact_commit")),
  );
}

export function requiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized === "") {
    throw new TypeError(
      localizedText(msg("ui.value1_is_required", { value1: label })),
    );
  }
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

async function inspectSource(
  model: InstallModel,
): Promise<PackageSourceInspection> {
  const secret = model.secretName.trim();
  try {
    return await packages.source.inspect(model.source, { secret });
  } catch (error) {
    if (secret !== "") throw error;
    throw new Error(
      `${
        errorMessage(
          error,
          localizedText(msg("package_management.repository_check_failed")),
        )
      }. For a private repository, choose an authentication secret.`,
    );
  }
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
    throw new Error(
      localizedText(
        msg("ui.could_not_synchronize_value1", { value1: failed.package_id }),
      ),
    );
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
