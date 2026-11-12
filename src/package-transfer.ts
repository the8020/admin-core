import { text as localizedText } from "/p/the8020/i18n/mod.ts";
import { msg } from "/p/the8020/admin-core/i18n/messages.ts";
import { packageId as packageField } from "/p/the8020/packages/types/package.ts";
import { sourceInfo } from "/p/the8020/packages/types/source.ts";
import { packages } from "/p/the8020/packages/src/admin.ts";
import {
  type ExportProblem,
  type ImportOutcome,
  importPackageList,
  type ImportPreview,
  type ImportState,
  isPlatformPackage,
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
  Model,
  nextScreenChannel,
  presentModal,
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

const short = (commit: string) => commit.slice(0, 7);

/** Short row result and the full explanation with the suggested next step. */
function checkResult(
  entry: PackageListEntry | ExportProblem,
): { result: string; detail: string } {
  const ui = {
    advanced: localizedText(msg("packages.advanced")),
    push: localizedText(msg("packages.push")),
    // The Refresh button label carries icon markup; prose needs only its text.
    refresh: localizedText(msg("programs.refresh")).replace(
      /^\[\[icon=[^\]]*\]\]\s*/,
      "",
    ),
  };
  if (!("code" in entry)) {
    return {
      result: status(
        "check_circle",
        "success",
        localizedText(msg("package_transfer.passed")),
      ),
      detail: localizedText(
        msg("package_transfer.detail_passed", {
          commit: short(entry.commit),
          source: entry.source,
        }),
      ),
    };
  }
  const [result, detail] = entry.code === "not_active"
    ? [
      msg("package_transfer.not_active"),
      msg("package_transfer.detail_not_active"),
    ]
    : entry.code === "no_remote"
    ? [
      msg("package_transfer.no_remote"),
      msg("package_transfer.detail_no_remote", ui),
    ]
    : entry.code === "not_in_remote"
    ? [
      msg("package_transfer.not_pushed", {
        commit: short(entry.detail ?? ""),
      }),
      msg("package_transfer.detail_not_in_remote", {
        ...ui,
        commit: entry.detail ?? "",
        source: entry.source ?? "",
      }),
    ]
    : [
      msg("package_transfer.check_failed"),
      msg("package_transfer.detail_failed", {
        ...ui,
        detail: entry.detail ?? "",
      }),
    ];
  return {
    result: status("error", "danger", localizedText(result)),
    detail: localizedText(detail),
  };
}

const ExportRow = z.object({
  package: packageField,
  result: field(z.string(), { label: msg("package_transfer.result") }),
  version: versionField,
  dependencies: field(z.string(), {
    label: msg("package_transfer.dependencies"),
  }),
});
const ExportScreen = z.object({ packages: z.array(ExportRow) });
type ExportRowData = z.infer<typeof ExportRow>;
const ExportDetail = z.object({
  result: field(z.string(), {
    label: msg("package_transfer.result"),
    readOnly: true,
  }),
  detail: field(z.string(), {
    label: msg("package_transfer.detail"),
    control: "textarea",
    readOnly: true,
    rowSpan: 6,
    length: "full",
  }),
  dependencies: field(z.string(), {
    label: msg("package_transfer.dependencies"),
    control: "textarea",
    readOnly: true,
    rowSpan: 4,
    length: "full",
  }),
});

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

/** One line per non-platform dependency, stating whether it is listed. */
function dependencyDetail(
  found: string[] | Error | undefined,
  rows: ExportRowData[],
): string {
  if (found instanceof Error) {
    return localizedText(
      msg("package_transfer.dependencies_failed", { detail: found.message }),
    );
  }
  if (!found?.length) {
    return localizedText(msg("package_transfer.dependencies_none"));
  }
  return found.map((id) =>
    localizedText(
      msg(
        rows.some((row) => row.package === id)
          ? "package_transfer.dependency_listed"
          : "package_transfer.dependency_missing",
        { package: id },
      ),
    )
  ).join("\n");
}

/** Status icon markup is presentation, not translated prose. */
function status(icon: string, color: string, text: string): string {
  return `[[icon=${icon} color=${color}]] ${text}`;
}

/**
 * Show the selected packages, verify them one by one with a short visible
 * result, open a row's full explanation on click, and export one list only
 * when all pass; Refresh resets every row to Waiting and checks all again.
 * Imported non-platform packages missing from the list only warn and can be
 * added to it.
 */
export async function packageExport(
  packageIds: string[],
  frame = new ScreenFrame(),
): Promise<ScreenResult> {
  const waiting = () => ({
    result: status(
      "hourglass_empty",
      "muted",
      localizedText(msg("package_transfer.waiting")),
    ),
    version: "",
    dependencies: "",
  });
  const rows: ExportRowData[] = packageIds.map((id) => ({
    package: id,
    ...waiting(),
  }));
  const details = new Map<string, string>();
  const entries = new Map<string, PackageListEntry>();
  /** Non-platform imports per checked package; absent when unreadable. */
  const imports = new Map<string, string[] | Error>();
  const missing = (packageId: string) => {
    const found = imports.get(packageId);
    return Array.isArray(found)
      ? found.filter((id) => !rows.some((row) => row.package === id))
      : [];
  };
  const showDependencies = () => {
    for (const row of rows) {
      const found = imports.get(row.package);
      const absent = missing(row.package);
      row.dependencies = !Array.isArray(found) || !found.length
        ? ""
        : absent.length
        ? status(
          "warning",
          "warning",
          localizedText(
            msg("package_transfer.dependencies_missing", {
              packages: absent.join(", "),
            }),
          ),
        )
        : status("check_circle", "success", found.join(", "));
    }
  };
  let channel = nextScreenChannel();
  let stopped = false;
  let finished = false;
  const check = async (targets: ExportRowData[]) => {
    for (const row of targets) {
      if (stopped) return;
      row.result = status(
        "sync",
        "info",
        localizedText(msg("package_transfer.checking")),
      );
      channel.redraw();
      const entry = await verifyExportEntry(row.package);
      const checked = checkResult(entry);
      row.result = checked.result;
      details.set(row.package, checked.detail);
      try {
        imports.set(
          row.package,
          (await packages.dependencies(row.package)).filter((id) =>
            !isPlatformPackage(id)
          ),
        );
      } catch (error) {
        imports.set(
          row.package,
          error instanceof Error ? error : new Error(String(error)),
        );
      }
      showDependencies();
      if (!("code" in entry)) {
        entries.set(row.package, entry);
        row.version = entry.tag
          ? `${entry.tag} (${short(entry.commit)})`
          : short(entry.commit);
      }
      channel.redraw();
    }
    finished = true;
    channel.exit("checked");
  };
  void check(rows);

  let file: PackageListFile | undefined;
  let reported = false;
  const reportBlocked = () =>
    sendMessage(
      localizedText(
        msg("package_transfer.export_blocked", {
          count: rows.length - entries.size,
          total: rows.length,
        }),
      ),
      "error",
    );
  let exporting = false;
  while (true) {
    if (finished && !reported) {
      reported = true;
      const incomplete = rows.filter((row) => missing(row.package).length);
      if (incomplete.length) {
        sendMessage(
          localizedText(
            msg("package_transfer.dependencies_warning", {
              count: incomplete.length,
            }),
          ),
          "warning",
        );
      }
      if (entries.size === rows.length) {
        file = {
          schema: 1,
          packages: rows.map((row) => entries.get(row.package)!),
        };
      } else reportBlocked();
    }
    // Checks redraw only the list call; a detail modal gets no channel.
    channel = nextScreenChannel();
    const pending = callScreen({
      id: "core-admin-package-export",
      title: msg("package_transfer.export_package_list"),
      schema: ExportScreen,
      layout: packageExportLayout,
      model: frame.model({ packages: rows }),
      header: {
        actions: finished
          ? [
            {
              id: "save",
              label: msg("layout.export"),
              kind: "primary" as const,
            },
            { id: "refresh", label: msg("programs.refresh") },
            ...(rows.some((row) => missing(row.package).length)
              ? [{
                id: "add-dependencies",
                label: msg("package_transfer.add_dependencies"),
              }]
              : []),
          ]
          : [],
      },
    });
    if (exporting && file) {
      try {
        downloadList(file, channel);
        sendMessage(
          localizedText(
            msg("package_transfer.exported", { count: entries.size }),
          ),
          "success",
        );
      } catch (error) {
        // Without a connected browser the screen keeps Export for a retry.
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          throw error;
        }
      }
    }
    exporting = false;
    const event = await pending;
    if (event.action === BACK_EVENT) {
      stopped = true;
      return { view: "back" };
    }
    if (event.action === "save") {
      exporting = true;
      if (!file) reportBlocked();
    }
    if (event.action === "refresh" && finished) {
      // Start over: every package waits and is checked again.
      finished = false;
      reported = false;
      file = undefined;
      entries.clear();
      details.clear();
      imports.clear();
      for (const row of rows) Object.assign(row, waiting());
      void check(rows);
      continue;
    }
    if (event.action === "add-dependencies" && finished) {
      // Added packages are checked too and may bring their own dependencies.
      const added = [...new Set(rows.flatMap((row) => missing(row.package)))]
        .sort().map((id): ExportRowData => ({ package: id, ...waiting() }));
      if (added.length) {
        rows.push(...added);
        showDependencies();
        finished = false;
        reported = false;
        file = undefined;
        void check(added);
      }
      continue;
    }
    const selected = event.action === "select" && "value" in event &&
        typeof event.value === "string"
      ? event.value
      : undefined;
    const detail = selected === undefined ? undefined : details.get(selected);
    if (detail !== undefined) {
      const row = rows.find((item) => item.package === selected)!;
      await presentModal(() =>
        callScreen({
          id: "core-admin-package-export-detail",
          title: row.package,
          schema: ExportDetail,
          // Form fields show values literally; icons render only in lists.
          model: new Model({
            result: row.result.replace(/^\[\[icon=[^\]]*\]\]\s*/, ""),
            detail,
            dependencies: dependencyDetail(imports.get(row.package), rows),
          }),
          controls: [
            { bind: "result" },
            { bind: "detail" },
            { bind: "dependencies" },
          ],
        })
      );
    }
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
  const key = item.code === "local"
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
