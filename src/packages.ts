import { packageInfo } from "/p/the8020/packages/types/package.ts";
import { programInfo } from "/p/the8020/packages/types/program.ts";
import {
  repositoryFields,
  sourceInfo,
} from "/p/the8020/packages/types/source.ts";
import {
  serviceId as serviceField,
  serviceInfo,
} from "/p/the8020/services/types/service.ts";
import { runtimeInfo } from "../types/runtime.ts";
import { ScreenFrame } from "./screen_frame.ts";
import {
  AdminCommandError,
  kernel,
  type PackageIndex,
  type PackageRepository,
} from "@the8020/kernel";
import {
  BACK_EVENT,
  callScreen,
  field,
  sendMessage,
  z,
} from "/p/the8020/uui/mod.ts";
import packageDetailLayout from "./layouts/package-detail.json" with {
  type: "json",
};
import packageListLayout from "./layouts/package-list.json" with {
  type: "json",
};
import packageAdvancedLayout from "./layouts/package-advanced.json" with {
  type: "json",
};
import { packageId as packageField } from "/p/the8020/packages/types/package.ts";
import { programId as programField } from "/p/the8020/packages/types/program.ts";
import type {
  PackageInspection,
  PackageInspectResult,
  PackageListResult,
  PackageSummary,
  ServiceSummary,
} from "./contracts.ts";
import type { ScreenResult } from "./navigation.ts";
import { packageDetailModel, packageRows } from "./view.ts";

const PackageRow = z.object({
  canonicalName: packageField,
  valid: packageInfo.shape.valid,
  status: packageInfo.shape.status,
  services: packageInfo.shape.serviceCount,
  description: packageInfo.shape.description,
});
const PackageList = z.object({ packages: z.array(PackageRow) });

const ServiceRow = z.object({
  navigation: z.string(),
  serviceId: serviceField,
  path: sourceInfo.shape.path,
  serviceType: serviceInfo.shape.serviceType,
  access: serviceInfo.shape.accessMode,
  entrypoint: sourceInfo.shape.entrypoint,
  valid: sourceInfo.shape.valid,
  description: serviceInfo.shape.description,
});
const ProgramRow = z.object({
  programId: programField,
  path: sourceInfo.shape.path,
  entrypoint: sourceInfo.shape.entrypoint,
  defaultLayout: programInfo.shape.defaultLayout,
  discoverable: programInfo.shape.discoverable,
  uui: programInfo.shape.uui,
  valid: sourceInfo.shape.valid,
  description: programInfo.shape.description,
});
const FileRow = z.object({
  path: sourceInfo.shape.path,
  type: sourceInfo.shape.type,
  size: sourceInfo.shape.size,
});
export function packageDetailSchema(
  repository: PackageRepository,
  canPersistSecret = true,
) {
  const git = repositoryFields(repository).shape;
  return z.object({
    packageId: field(packageField, {
      length: "long",
      readOnly: true,
      open: undefined,
    }),
    path: field(sourceInfo.shape.path, { length: "long", readOnly: true }),
    description: field(packageInfo.shape.description, {
      length: "long",
      readOnly: true,
    }),
    documentationUrl: field(packageInfo.shape.documentationUrl, {
      length: "long",
      readOnly: true,
    }),
    license: field(packageInfo.shape.license, {
      length: "short",
      readOnly: true,
    }),
    valid: field(packageInfo.shape.valid, { length: "short", readOnly: true }),
    serviceCount: field(packageInfo.shape.serviceCount, {
      length: "short",
      readOnly: true,
    }),
    programCount: field(packageInfo.shape.programCount, {
      length: "short",
      readOnly: true,
    }),
    fileCount: field(packageInfo.shape.fileCount, {
      length: "short",
      readOnly: true,
    }),
    validation: field(packageInfo.shape.validation, {
      length: "long",
      readOnly: true,
    }),
    inspection: field(packageInfo.shape.inspection, {
      length: "long",
      readOnly: true,
    }),
    repositoryStatus: field(sourceInfo.shape.repositoryStatus, {
      length: "short",
      readOnly: true,
    }),
    activationReady: field(sourceInfo.shape.activationReady, {
      length: "short",
      readOnly: true,
    }),
    clean: field(sourceInfo.shape.clean, { length: "short", readOnly: true }),
    branch: field(git.branch, { label: "Current branch", length: "long" }),
    head: field(git.commit, { label: "Current commit", length: "long" }),
    remoteName: field(sourceInfo.shape.remoteName, {
      length: "short",
      readOnly: true,
    }),
    remoteUrl: field(sourceInfo.shape.remoteUrl, {
      length: "long",
      readOnly: true,
    }),
    secretName: field(sourceInfo.shape.secretName, {
      length: "long",
      hidden: !canPersistSecret,
    }),
    services: z.array(ServiceRow),
    programs: z.array(ProgramRow),
    files: z.array(FileRow),
  });
}

export async function packageList(
  frame = new ScreenFrame(),
): Promise<ScreenResult> {
  while (true) {
    const [packages, services] = await Promise.all([
      kernel.packages.list<PackageSummary>(),
      kernel.services.list<ServiceSummary>(),
    ]);
    const result: PackageListResult = { packages, services };
    const event = await callScreen({
      id: "core-admin-packages",
      title: "Packages",
      schema: PackageList,
      model: frame.model({
        packages: packageRows(result).map((item) => ({
          ...item,
          status: item.valid ? "Ready" : "Needs attention",
        })),
      }),
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

export async function packageDetail(
  packageId: string,
  frame = new ScreenFrame(),
): Promise<ScreenResult> {
  const Screen = z.object({
    description: field(packageInfo.shape.description, {
      readOnly: true,
      length: "long",
    }),
    status: field(packageInfo.shape.status, {
      readOnly: true,
      length: "short",
    }),
    license: field(packageInfo.shape.license, {
      readOnly: true,
      length: "short",
    }),
    documentation: field(packageInfo.shape.documentationUrl, {
      readOnly: true,
      length: "long",
    }),
    issue: field(packageInfo.shape.issue, {
      readOnly: true,
      length: "long",
      control: "textarea",
      rowSpan: 2,
    }),
    services: z.array(z.object({
      id: serviceField,
      description: field(serviceInfo.shape.description, { label: "Service" }),
      state: serviceInfo.shape.state,
      workers: runtimeInfo.shape.workerCount,
    })),
    programs: z.array(z.object({
      id: programField,
      description: field(programInfo.shape.description, { label: "Program" }),
      kind: programInfo.shape.kind,
    })),
  });
  while (true) {
    const [inspection, services, index] = await Promise.all([
      kernel.packages.inspect<PackageInspection>(packageId),
      kernel.services.list<ServiceSummary>(),
      optionalPackageIndex(packageId),
    ]);
    const issue = [
      ...(inspection.validation_errors ?? []),
      ...(inspection.inspection_errors ?? []),
    ].join("\n");
    const model = {
      description: inspection.description ?? "",
      status: inspection.valid ? "Ready" : "Needs attention",
      license: inspection.license ?? "",
      documentation: inspection.documentation_url ?? "",
      issue,
      services: services.filter((service) => service.package_id === packageId)
        .map((service) => ({
          id: service.service_id,
          description: service.description || service.service_id,
          state: service.state,
          workers: service.worker_count,
        })),
      programs: (inspection.programs ?? []).map((program) => ({
        id: program.program_id,
        description: program.description || program.program_id,
        kind: !program.valid
          ? "Unavailable"
          : program.uui
          ? "Interactive"
          : "Background job",
      })),
    };
    const event = await callScreen({
      id: "core-admin-package-detail",
      title: `Package ${packageId}`,
      schema: Screen,
      model: frame.model(model),
      layout: {
        ...packageDetailLayout,
        root: {
          ...packageDetailLayout.root,
          children: packageDetailLayout.root.children.filter((child) =>
            (child.id !== "services" || model.services.length > 0) &&
            (child.id !== "programs" || model.programs.length > 0)
          ),
        },
      },
      controls: [
        { bind: "description", hidden: !model.description },
        { bind: "status" },
        { bind: "license", hidden: !model.license },
        { bind: "documentation", hidden: !model.documentation },
        { bind: "issue", hidden: !issue },
        { bind: "services" },
        { bind: "programs" },
      ],
      header: {
        actions: [
          ...(index !== undefined && !index.local
            ? [{ id: "versions", label: "Versions", kind: "primary" as const }]
            : []),
          { id: "refresh", label: "Refresh" },
          { id: "advanced", label: "Advanced" },
        ],
      },
    });
    if (event.action === BACK_EVENT) return { view: "back" };
    if (event.action === "advanced") {
      return { view: "packageAdvanced", packageId };
    }
    if (event.action === "versions") {
      return { view: "packageVersions", packageId };
    }
    if (event.action === "select" && typeof event.value === "string") {
      if (event.bind === "services") {
        return { view: "service", serviceId: event.value };
      }
      if (event.bind === "programs") {
        return { view: "program", programId: event.value };
      }
    }
  }
}

export async function packageAdvanced(
  packageId: string,
  frame = new ScreenFrame(),
): Promise<ScreenResult> {
  while (true) {
    const [inspection, repository, index, services] = await Promise.all([
      kernel.packages.inspect<PackageInspection>(packageId),
      kernel.packages.repository.inspect(packageId),
      optionalPackageIndex(packageId),
      kernel.services.list<ServiceSummary>(),
    ]);
    const result: PackageInspectResult = { package: inspection, services };
    const model = packageDetailModel(
      result,
      repository,
      index?.secret ?? "",
    );
    const event = await callScreen({
      id: "core-admin-package-advanced",
      title: `Advanced · ${packageId}`,
      schema: packageDetailSchema(
        repository,
        index !== undefined,
      ),
      model: frame.model(model),
      layout: packageAdvancedLayout,
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
    if (
      event.action === "select" && event.bind === "programs" &&
      typeof event.value === "string"
    ) {
      return { view: "program", programId: event.value };
    }
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
