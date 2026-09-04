import {
  AdminCommandError,
  kernel,
  type PackageIndex,
  type PackageRepository,
  type SecretSummary,
} from "@the8020/kernel";
import {
  BACK_EVENT,
  callScreen,
  field,
  sendMessage,
  z,
} from "@packages/the8020/uui/mod.ts";
import packageDetailLayout from "./layouts/package-detail.json" with {
  type: "json",
};
import packageListLayout from "./layouts/package-list.json" with {
  type: "json",
};
import type {
  PackageInspection,
  PackageInspectResult,
  PackageListResult,
  PackageSummary,
} from "./contracts.ts";
import type { ScreenResult } from "./navigation.ts";
import { packageDetailModel, packageRows } from "./view.ts";

const PackageRow = z.object({
  canonicalName: z.string(),
  valid: z.boolean(),
  services: z.number().int(),
  description: z.string(),
});
const PackageList = z.object({ packages: z.array(PackageRow) });

const ServiceRow = z.object({
  navigation: z.string(),
  serviceId: z.string(),
  path: z.string(),
  serviceType: z.string(),
  access: z.string(),
  entrypoint: z.string(),
  valid: z.boolean(),
  description: z.string(),
});
const ProgramRow = z.object({
  programId: z.string(),
  path: z.string(),
  entrypoint: z.string(),
  defaultLayout: z.string(),
  discoverable: z.boolean(),
  valid: z.boolean(),
  description: z.string(),
});
const FileRow = z.object({
  path: z.string(),
  type: z.string(),
  size: z.number().int(),
});
export function packageDetailSchema(
  repository: PackageRepository,
  secrets: SecretSummary[],
  selectedSecret = "",
  canPersistSecret = true,
) {
  return z.object({
    packageId: field(z.string(), {
      label: "Canonical name",
      length: "long",
      readOnly: true,
    }),
    path: field(z.string(), { label: "Path", length: "long", readOnly: true }),
    description: field(z.string(), {
      label: "Description",
      length: "long",
      readOnly: true,
    }),
    documentationUrl: field(z.string(), {
      label: "Documentation",
      length: "long",
      readOnly: true,
    }),
    license: field(z.string(), {
      label: "License",
      length: "short",
      readOnly: true,
    }),
    valid: field(z.boolean(), {
      label: "Valid",
      length: "short",
      readOnly: true,
    }),
    serviceCount: field(z.number().int(), {
      label: "Services",
      length: "short",
      readOnly: true,
    }),
    programCount: field(z.number().int(), {
      label: "Programs",
      length: "short",
      readOnly: true,
    }),
    fileCount: field(z.number().int(), {
      label: "Visible files",
      length: "short",
      readOnly: true,
    }),
    validation: field(z.string(), {
      label: "Validation",
      length: "long",
      readOnly: true,
    }),
    inspection: field(z.string(), {
      label: "Inspection",
      length: "long",
      readOnly: true,
    }),
    repositoryStatus: field(z.string(), {
      label: "Status",
      length: "short",
      readOnly: true,
    }),
    activationReady: field(z.boolean(), {
      label: "Activation ready",
      length: "short",
      readOnly: true,
    }),
    clean: field(z.boolean(), {
      label: "Clean",
      length: "short",
      readOnly: true,
    }),
    branch: field(z.string(), {
      label: "Current branch",
      length: "long",
      control: "select",
      options: repository.branches.map((branch) => ({
        value: branch.name,
        label: branch.remote
          ? `${branch.name} (remote)`
          : branch.current
          ? `${branch.name} (current)`
          : branch.name,
      })),
    }),
    head: field(z.string(), {
      label: "Current commit",
      length: "long",
      control: "select",
      options: repository.commits.map((commit) => ({
        value: commit.commit,
        label: `${commit.short_commit} — ${commit.subject}`,
      })),
    }),
    remoteName: field(z.string(), {
      label: "Remote",
      length: "short",
      readOnly: true,
    }),
    remoteUrl: field(z.string(), {
      label: "Remote URL",
      length: "long",
      readOnly: true,
    }),
    secretName: field(z.string(), {
      label: "Authentication secret",
      description:
        "Only the stored secret name is saved with the package; its value remains in kernel secret storage.",
      length: "long",
      control: "select",
      hidden: !canPersistSecret,
      options: [
        { value: "", label: "No secret (public repository)" },
        ...(selectedSecret !== "" &&
            !secrets.some((secret) => secret.name === selectedSecret)
          ? [{ value: selectedSecret, label: `${selectedSecret} (missing)` }]
          : []),
        ...secrets.map((secret) => ({
          value: secret.name,
          label: secret.name,
        })),
      ],
    }),
    services: z.array(ServiceRow),
    programs: z.array(ProgramRow),
    files: z.array(FileRow),
  });
}

export async function packageList(): Promise<ScreenResult> {
  while (true) {
    const result = {
      packages: await kernel.packages.list<PackageSummary>(),
    } as PackageListResult;
    const event = await callScreen({
      id: "core-admin-packages",
      title: "Packages",
      schema: PackageList,
      model: { packages: packageRows(result) },
      layout: packageListLayout,
      header: {
        actions: [
          { id: "install", label: "Install package", kind: "primary" },
          { id: "local", label: "Create local package" },
          { id: "update-all", label: "Update all" },
          { id: "refresh", label: "[[icon=refresh]] Refresh" },
        ],
      },
    });
    if (event.action === BACK_EVENT) return { view: "back" };
    if (event.action === "refresh") continue;
    if (event.action === "install") return { view: "packageInstall" };
    if (event.action === "local") return { view: "packageLocal" };
    if (event.action === "update-all") {
      try {
        const updated = await updateAllPackages();
        sendMessage(
          updated === 0
            ? "No published packages to update"
            : `Updated ${updated} ${
              updated === 1 ? "package" : "packages"
            } to latest`,
          updated === 0 ? "info" : "success",
        );
      } catch (error) {
        sendMessage(
          error instanceof Error ? error.message : "Package update failed",
          "error",
        );
      }
      continue;
    }
    return event.action === "select" && typeof event.value === "string"
      ? { view: "package", packageId: event.value }
      : { view: "back" };
  }
}

async function updateAllPackages(): Promise<number> {
  const indexes = await kernel.packages.index.list();
  const published = indexes.filter((index) => index.valid && !index.local);

  await Promise.all(
    published
      .filter((index) => index.commit !== undefined || index.tag !== undefined)
      .map((index) =>
        kernel.packages.index.set({
          author: index.author,
          repository: index.repository,
          source: index.source,
          secret: index.secret,
        })
      ),
  );

  if (published.length === 0) return 0;
  const results = await kernel.packages.synchronize(
    published.map((index) => index.package_id),
  );
  const failure = results.find((result) => !result.success);
  if (failure !== undefined) {
    throw new Error(`Could not update ${failure.package_id}`);
  }
  return results.length;
}

export async function packageDetail(packageId: string): Promise<ScreenResult> {
  while (true) {
    const [inspection, repository, index] = await Promise.all([
      kernel.packages.inspect<PackageInspection>(packageId),
      kernel.packages.repository.inspect(packageId),
      optionalPackageIndex(packageId),
    ]);
    const result = { package: inspection } as PackageInspectResult;
    const secrets = index === undefined ? [] : await kernel.secrets.list();
    const model = packageDetailModel(
      result,
      repository,
      index?.secret ?? "",
    );
    const event = await callScreen({
      id: "core-admin-package-detail",
      title: `Package ${packageId}`,
      schema: packageDetailSchema(
        repository,
        secrets,
        index?.secret ?? "",
        index !== undefined,
      ),
      model,
      layout: packageDetailLayout,
      header: {
        actions: [
          { id: "pull", label: "Pull", kind: "primary" },
          { id: "push", label: "Push" },
          { id: "checkout-branch", label: "Checkout branch" },
          { id: "checkout-commit", label: "Checkout commit" },
          ...(index === undefined
            ? []
            : [{ id: "save-secret", label: "Save secret" }]),
          { id: "versions", label: "Versions" },
          { id: "synchronize", label: "Synchronize" },
          {
            id: "refresh",
            label: "[[icon=refresh color=warning]] Refresh",
          },
        ],
      },
    });
    if (event.action === BACK_EVENT) return { view: "back" };
    if (
      event.action === "select" && typeof event.value === "string" &&
      event.value.startsWith("service:")
    ) return { view: "service", serviceId: event.value.slice(8) };
    if (event.action === "versions") {
      return { view: "packageVersions", packageId };
    }
    if (event.action === "refresh") continue;
    try {
      switch (event.action) {
        case "pull":
          await kernel.packages.repository.pull(packageId);
          sendMessage(`Pulled ${packageId}`, "success");
          break;
        case "push":
          await kernel.packages.repository.push(packageId);
          sendMessage(`Pushed ${packageId}`, "success");
          break;
        case "checkout-branch":
          await kernel.packages.repository.checkout({
            packageId,
            branch: requiredSelection(model.branch, "branch"),
          });
          sendMessage(`Checked out branch ${model.branch}`, "success");
          break;
        case "checkout-commit":
          await kernel.packages.repository.checkout({
            packageId,
            commit: requiredSelection(model.head, "commit"),
          });
          sendMessage(`Checked out ${model.head.slice(0, 12)}`, "success");
          break;
        case "save-secret":
          if (index === undefined) {
            throw new Error("Package has no desired index metadata");
          }
          await savePackageSecret(index, model.secretName);
          sendMessage(
            `Saved Git authentication for ${packageId}`,
            "success",
          );
          break;
        case "synchronize": {
          const results = await kernel.packages.synchronize([packageId]);
          const failure = results.find((result) => !result.success);
          if (failure !== undefined) {
            throw new Error(`Could not synchronize ${failure.package_id}`);
          }
          sendMessage(`Synchronized ${packageId}`, "success");
          break;
        }
      }
    } catch (error) {
      sendMessage(
        error instanceof Error ? error.message : "Package operation failed",
        "error",
      );
    }
  }
}

async function optionalPackageIndex(
  packageId: string,
): Promise<PackageIndex | undefined> {
  try {
    return await kernel.packages.index.inspect(packageId);
  } catch (error) {
    if (error instanceof AdminCommandError && error.code === "not_found") {
      return undefined;
    }
    throw error;
  }
}

function requiredSelection(value: string, label: string): string {
  if (value.trim() === "") throw new TypeError(`Select a ${label}`);
  return value;
}

function savePackageSecret(
  index: PackageIndex,
  secret: string,
): Promise<PackageIndex> {
  return kernel.packages.index.set({
    author: index.author,
    repository: index.repository,
    source: index.source,
    commit: index.commit,
    tag: index.tag,
    local: index.local,
    secret,
  });
}
