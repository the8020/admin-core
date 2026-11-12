import { text as localizedText } from "/p/the8020/i18n/mod.ts";
import { msg } from "/p/the8020/admin-core/i18n/messages.ts";
import { packageId as packageField } from "/p/the8020/packages/types/package.ts";
import { sourceInfo } from "/p/the8020/packages/types/source.ts";
import {
  type ExportProblem,
  type ImportOutcome,
  importPackageList,
  type ImportPreview,
  type ImportState,
  type PackageListEntry,
  type PackageListFile,
  packageListFile,
  previewImport,
  verifyExportEntry,
} from "/p/the8020/packages/src/transfer.ts";
import type { PackageIndex } from "@the8020/kernel";
import {
  BACK_EVENT,
  callScreen,
  download,
  field,
  fileUpload,
  nextScreenChannel,
  sendMessage,
  z,
} from "/p/the8020/uui/mod.ts";
import packageImportLayout from "./layouts/package-import.json" with {
  type: "json",
};
import packageExportLayout from "./layouts/package-export.json" with {
  type: "json",
};
import { ScreenFrame } from "./screen_frame.ts";
import type { ScreenResult } from "./navigation.ts";

const MAX_FILE_BYTES = 262144;
const MAX_ERRORS = 10;

export const versionField = field(z.string(), {
  label: msg("package_transfer.version"),
});

/** Desired tag with the running commit; export decides the exact remote tag. */
export function versionLabel(index?: PackageIndex): string {
  const commit = index?.active_commit?.slice(0, 7) ?? "";
  return index?.tag ? `${index.tag} (${commit})` : commit;
}

const problemKeys: Record<
  Exclude<ExportProblem["code"], "failed">,
  string
> = {
  not_active: "package_transfer.not_active",
  no_remote: "package_transfer.no_remote",
  identity: "package_transfer.identity",
  not_in_remote: "package_transfer.not_in_remote",
};

function problemText(problem: ExportProblem): string {
  return problem.code === "failed" ? problem.detail ?? "" : localizedText(
    msg(problemKeys[problem.code], { detail: problem.detail ?? "" }),
  );
}

const ExportRow = z.object({
  package: packageField,
  result: field(z.string(), { label: msg("package_transfer.result") }),
  version: versionField,
});
const ExportScreen = z.object({ packages: z.array(ExportRow) });
type ExportRowData = z.infer<typeof ExportRow>;

function downloadList(
  file: PackageListFile,
  channel: ReturnType<typeof nextScreenChannel>,
): void {
  download({
    filename: `packages-${new Date().toISOString().slice(0, 10)}.json`,
    contentType: "application/json",
    body: new Blob([JSON.stringify(file, null, 2) + "\n"]).stream(),
  }, channel.downloads);
}

/**
 * Show the selected packages, verify them one by one with a visible result,
 * and offer one list only when all pass.
 */
export async function packageExport(
  packageIds: string[],
  frame = new ScreenFrame(),
): Promise<ScreenResult> {
  const rows: ExportRowData[] = packageIds.map((id) => ({
    package: id,
    result: localizedText(msg("package_transfer.waiting")),
    version: "",
  }));
  const screen = {
    id: "core-admin-package-export",
    title: msg("package_transfer.export_package_list"),
    schema: ExportScreen,
    layout: packageExportLayout,
  };
  const checking = nextScreenChannel();
  const pending = callScreen({
    ...screen,
    model: frame.model({ packages: rows }),
  });
  let left = false;
  const entries: PackageListEntry[] = [];
  const checks = (async () => {
    for (const row of rows) {
      if (left) return;
      row.result = localizedText(msg("package_transfer.checking"));
      checking.redraw();
      const entry = await verifyExportEntry(row.package);
      if ("code" in entry) row.result = problemText(entry);
      else {
        entries.push(entry);
        row.result = localizedText(msg("package_transfer.passed"));
        row.version = entry.tag
          ? `${entry.tag} (${entry.commit.slice(0, 7)})`
          : entry.commit.slice(0, 7);
      }
      checking.redraw();
    }
    if (!left) checking.exit("checked");
  })();
  const event = await pending;
  left = true;
  if (event.action !== "checked") return { view: "back" };
  await checks;

  const blocked = rows.length - entries.length;
  const file: PackageListFile | undefined = blocked
    ? undefined
    : { schema: 1, packages: entries };
  sendMessage(
    localizedText(
      file
        ? msg("package_transfer.exported", { count: entries.length })
        : msg("package_transfer.export_blocked", {
          count: blocked,
          total: rows.length,
        }),
    ),
    file ? "success" : "error",
  );
  let offer = file !== undefined;
  while (true) {
    const channel = nextScreenChannel();
    const done = callScreen({
      ...screen,
      model: frame.model({ packages: rows }),
      header: {
        actions: file
          ? [{
            id: "download",
            label: msg("package_transfer.download"),
            kind: "primary" as const,
          }]
          : [],
      },
    });
    try {
      if (file && offer) downloadList(file, channel);
    } catch (error) {
      console.error("DIAG export download", String((error as Error)?.name), String((error as Error)?.message), String((error as Error)?.stack));
      throw error;
    }
    const action = (await done).action;
    if (action === BACK_EVENT) return { view: "back" };
    offer = action === "download";
  }
}

const stateLabels: Record<ImportState, ReturnType<typeof msg>> = {
  new: msg("package_transfer.state_new"),
  same: msg("package_transfer.state_same"),
  different: msg("package_transfer.state_different"),
  local: msg("package_transfer.state_local"),
};

const ImportRow = z.object({
  package: packageField,
  source: sourceInfo.shape.source,
  version: versionField,
  current: field(z.string(), { label: msg("package_transfer.installed") }),
  state: field(z.string(), { label: msg("package_transfer.state") }),
  selected: z.boolean(),
});
const ImportScreen = z.object({
  file: field(z.string(), { label: msg("package_transfer.package_list") }),
  packages: z.array(ImportRow),
});

function importRows(preview: ImportPreview[], selected: Set<string>) {
  return preview.map((item) => ({
    package: item.package,
    source: item.source,
    version: item.tag
      ? `${item.tag} (${item.commit.slice(0, 7)})`
      : item.commit.slice(0, 7),
    current: item.current ?? "",
    state: localizedText(stateLabels[item.state]),
    selected: selected.has(item.package),
  }));
}

function outcomeText(item: ImportOutcome): string {
  const key = item.code === "identity"
    ? "package_transfer.problem_identity"
    : item.code === "local"
    ? "package_transfer.outcome_local"
    : item.code === "install"
    ? "package_transfer.outcome_install"
    : "package_transfer.problem_failed";
  return localizedText(
    msg(key, { package: item.package, detail: item.detail ?? "" }),
  );
}

function parseList(bytes: Uint8Array): PackageListFile {
  try {
    return packageListFile.parse(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    );
  } catch (error) {
    throw new Error(
      localizedText(
        msg("package_transfer.invalid_file", {
          detail: error instanceof z.ZodError
            ? z.prettifyError(error)
            : error instanceof Error
            ? error.message
            : String(error),
        }),
      ),
    );
  }
}

/** Preview a package list against this system and import the chosen rows. */
export async function packageImport(
  frame = new ScreenFrame(),
): Promise<ScreenResult> {
  const state = frame.context<{
    file?: PackageListFile;
    selected: Set<string>;
  }>({ selected: new Set() });
  let preview = state.file ? await previewImport(state.file) : [];
  while (true) {
    const upload = fileUpload({
      maximumBytes: MAX_FILE_BYTES,
      accept: ".json,application/json",
    });
    const model = frame.model({
      file: "",
      packages: importRows(preview, state.selected),
    });
    const event = await callScreen({
      id: "core-admin-package-import",
      title: msg("package_transfer.import_package_list"),
      schema: ImportScreen,
      model,
      layout: {
        ...packageImportLayout,
        root: {
          ...packageImportLayout.root,
          children: packageImportLayout.root.children.filter((child) =>
            child.id !== "packages" || preview.length > 0
          ),
        },
      },
      controls: [
        {
          id: "file",
          bind: "file",
          custom: upload.custom,
          fieldHelp: false,
          length: "long",
        },
        { bind: "packages" },
      ],
      header: {
        actions: [
          { id: "load", label: msg("package_transfer.load"), kind: "primary" },
          ...(preview.length
            ? [
              { id: "import", label: msg("package_transfer.import") },
              {
                id: "install",
                label: msg("package_transfer.import_and_install"),
              },
            ]
            : []),
        ],
      },
    });
    state.selected = new Set(
      model.data.packages.filter((row) => row.selected).map((row) =>
        row.package
      ),
    );
    if (event.action === BACK_EVENT) return { view: "back" };
    try {
      if (event.action === "load") {
        state.file = parseList(upload.take());
        preview = await previewImport(state.file);
        // Existing packages change only after an explicit choice.
        state.selected = new Set(
          preview.filter((item) => item.state === "new").map((item) =>
            item.package
          ),
        );
        continue;
      }
      if (
        (event.action !== "import" && event.action !== "install") ||
        !state.file
      ) continue;
      if (!state.selected.size) {
        sendMessage(
          localizedText(msg("packages.select_packages_first")),
          "info",
        );
        continue;
      }
      const outcomes = await importPackageList(state.file, {
        packages: [...state.selected],
        overwrite: true,
        install: event.action === "install",
      });
      const failed = outcomes.filter((item) => item.outcome === "failed");
      const imported = outcomes.filter((item) =>
        item.outcome === "imported"
      ).length;
      sendMessage(
        [
          localizedText(
            msg("package_transfer.imported_summary", {
              imported,
              skipped: outcomes.length - imported - failed.length,
              failed: failed.length,
            }),
          ),
          ...failed.slice(0, MAX_ERRORS).map(outcomeText),
        ].join("\n"),
        failed.length ? "warning" : imported ? "success" : "info",
      );
      preview = await previewImport(state.file);
      state.selected = new Set();
    } catch (error) {
      sendMessage(
        error instanceof Error ? error.message : String(error),
        "error",
      );
    }
  }
}
