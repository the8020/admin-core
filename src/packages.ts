import { kernel } from "@the8020/kernel";
import {
  BACK_EVENT,
  callScreen,
  field,
  showNotification,
  z,
} from "@packages/the8020/uui/mod.ts";
import packageDetailLayout from "./layouts/package-detail.json" with {
  type: "json",
};
import packageListLayout from "./layouts/package-list.json" with {
  type: "json",
};
import type {
  PackageInspectResult,
  PackageListResult,
  PackageRepositoryInspectResult,
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
const PackageDetail = z.object({
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
    label: "Branch",
    length: "short",
    readOnly: true,
  }),
  head: field(z.string(), { label: "HEAD", length: "long", readOnly: true }),
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
  services: z.array(ServiceRow),
  programs: z.array(ProgramRow),
  files: z.array(FileRow),
});

export async function packageList(): Promise<ScreenResult> {
  while (true) {
    const result = await kernel.admin.execute<PackageListResult>(
      "package.list",
    );
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
          { id: "refresh", label: "[[icon=refresh]] Refresh" },
        ],
      },
    });
    if (event.action === BACK_EVENT) return { view: "back" };
    if (event.action === "refresh") continue;
    if (event.action === "install") return { view: "packageInstall" };
    if (event.action === "local") return { view: "packageLocal" };
    return event.action === "select" && typeof event.value === "string"
      ? { view: "package", packageId: event.value }
      : { view: "back" };
  }
}

export async function packageDetail(packageId: string): Promise<ScreenResult> {
  while (true) {
    const [result, repositoryResult] = await Promise.all([
      kernel.admin.execute<PackageInspectResult>("package.inspect", {
        package_id: packageId,
      }),
      kernel.admin.execute<PackageRepositoryInspectResult>(
        "package.repository.inspect",
        { package_id: packageId },
      ),
    ]);
    const event = await callScreen({
      id: "core-admin-package-detail",
      title: `Package ${packageId}`,
      schema: PackageDetail,
      model: packageDetailModel(result, repositoryResult),
      layout: packageDetailLayout,
      header: {
        actions: [
          { id: "versions", label: "Versions" },
          { id: "synchronize", label: "Synchronize", kind: "primary" },
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
    if (event.action === "synchronize") {
      try {
        const results = await kernel.packages.synchronize([packageId]);
        const failure = results.find((result) => !result.success);
        if (failure !== undefined) {
          throw new Error(`Could not synchronize ${failure.package_id}`);
        }
        showNotification(`Synchronized ${packageId}`, "success");
      } catch (error) {
        showNotification(
          error instanceof Error
            ? error.message
            : "Package synchronization failed",
          "error",
        );
      }
    }
  }
}
