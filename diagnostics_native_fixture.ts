import { assert, assertEquals } from "@std/assert";
import type { NativeBrowserFixtureContext } from "../uui/browser_e2e.ts";

/** Real CBus, logd, browser saves and the installed sandbox skill. */
export default async function verify(c: NativeBrowserFixtureContext) {
  const {
    page,
    admin,
    clickRow,
    setValue,
    waitForPage,
    waitForScreen,
  } = c;
  const clickButton = async (target: typeof page, label: string) => {
    await c.clickButton(target, label);
    await waitForPage(
      target,
      `document.querySelector('[aria-busy="true"]') === null`,
      `${label} completed`,
      30_000,
    );
  };
  const node = (await admin(["kernel.status"])).instance_uuid as string;
  await admin(["auth.roles.create", "diagnostics"]);
  await admin([
    "auth.roles.grant",
    "diagnostics",
    "the8020.admin-core.kernel.execute",
    "*",
  ]);
  await admin([
    "auth.roles.grant",
    "diagnostics",
    "the8020.admin-core.logs.view",
    node.replaceAll("-", "\\-"),
  ]);
  await admin(["auth.users.assign", c.credentials.username, "diagnostics"]);
  await admin(["dev-core.sandbox.create", c.credentials.username]);
  await admin(["dev-core.sandbox.start", c.credentials.username]);
  const shell = async (command: string) => {
    const response = await admin([
      "dev-core.sandbox.shell",
      c.credentials.username,
      "--command",
      command,
    ]);
    return (response.shell as { output: string }).output;
  };
  assert(
    (await shell(
      "test -f ~/.agents/skills/8020-dev/SKILL.md && command -v kernel-logs",
    )).includes("kernel-logs"),
  );
  const query = { source: "kernel", text: "development sandbox", limit: 1 };
  const read = async (q: object) =>
    JSON.parse(await shell(`kernel-logs '${JSON.stringify(q)}'`));
  const first = JSON.parse(
    await shell(
      `kernel-logs '${JSON.stringify(query)}' | tee /tmp/kernel-page.json`,
    ),
  );
  assertEquals(first.node_id, node);
  assertEquals(first.page.state, "ok");
  assertEquals(first.page.records.length, 1);
  assertEquals(first.page.records[0].node_id, node);
  assert(first.page.records[0].message.includes("development sandbox"));
  const second = JSON.parse(
    await shell(`
query=$(deno eval 'const {page}=JSON.parse(Deno.readTextFileSync("/tmp/kernel-page.json")); if(page.state!=="ok") throw new Error(page.reason); console.log(JSON.stringify({text:"development sandbox",source:"kernel",limit:1,cursor:page.cursor}));')
kernel-logs "$query"
`),
  );
  assertEquals(second.node_id, node);
  assertEquals(second.page.records.length, 1);
  assert(second.page.records[0].message !== first.page.records[0].message);
  const errors = await read({
    source: "kernel",
    level: "error",
    tail: true,
    from: "2026-01-01T00:00:00Z",
  });
  assertEquals(errors.node_id, node);
  assertEquals(errors.page.state, "ok");
  const rejection = await shell(
    "DEVELOPMENT_ACTIVATION_TOKEN=invalid kernel-logs 2>&1 || true",
  );
  assert(rejection.includes("401"));
  const foreign = await shell(
    'kernel-logs \'{"node_id":"nod-0000000000"}\' 2>&1 || true',
  );
  assert(foreign.includes("hosting node"));
  console.log(
    "Diagnostics sandbox: installed skill, exact host, search/continuation and token/node rejection passed.",
  );

  await clickButton(page, "Refresh");
  await clickRow(page, "the8020/admin-core/kernel-console");
  await waitForScreen(page, "Kernel calls", 30_000);
  await clickButton(page, "Calls");
  await waitForPage(
    page,
    `document.querySelector('dialog[open] [data-list-id]') !== null`,
    "catalog picker",
  ).catch(async (error) => {
    const state = await page.evaluate(
      `({body:document.body.innerText,output:document.querySelector('textarea[data-bind="output"]')?.value})`,
    );
    throw new Error(`${error.message}; ${JSON.stringify(state)}`);
  });
  await clickRow(page, "kernel.status");
  await waitForPage(
    page,
    `document.querySelector('input[data-bind="line"]')?.value.startsWith('kernel.status')`,
    "selected command populates input",
  );
  await clickButton(page, "Run");
  await waitForPage(
    page,
    `document.querySelector('textarea[data-bind="output"]')?.value.includes(${
      JSON.stringify(node)
    })`,
    "real kernel response",
  );
  await setValue(
    page,
    '[data-bind="line"]',
    "kernel.events.emit diagnostics.probe",
  );
  await clickButton(page, "Run");
  await waitForPage(
    page,
    `document.querySelector('textarea[data-bind="output"]')?.value.includes('listeners')`,
    "safe state-changing native call",
  );
  await setValue(page, '[data-bind="line"]', "kernel.config.set");
  await clickButton(page, "Run");
  await waitForPage(
    page,
    `document.querySelector('textarea[data-bind="output"]')?.value.includes('invalid_arguments')`,
    "native argument rejection",
  );
  await page.command("Browser.grantPermissions", {
    origin: c.baseURL,
    permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
  });
  await clickButton(page, "Copy result");
  await waitForPage(
    page,
    `(async () => (await navigator.clipboard.readText()).includes('invalid_arguments'))()`,
    "console copy",
  );
  console.log(
    "Diagnostics console: catalog selection, native read/mutation/error and clipboard passed.",
  );

  await clickButton(page, "Back");
  await waitForScreen(page, "Welcome to 80|20");
  await clickRow(page, "the8020/admin-core/kernel-logs");
  await waitForScreen(page, "Kernel logs", 30_000);
  await setValue(page, '[data-bind="text"]', "development sandbox");
  await clickButton(page, "First");
  await waitForPage(
    page,
    `document.querySelector('textarea[data-bind="output"]')?.value.includes('development sandbox created')`,
    "real log search",
  );
  const output = await page.evaluate<string>(
    `document.querySelector('textarea[data-bind="output"]').value`,
  );
  assert(output.includes(node));
  await clickButton(page, "Copy page");
  await waitForPage(
    page,
    `(async () => (await navigator.clipboard.readText()) === ${
      JSON.stringify(output)
    })()`,
    "exact page copy",
  );
  const downloads = `${c.root}/diagnostics-downloads`;
  await Deno.mkdir(downloads);
  await page.command("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: downloads,
  });
  await clickButton(page, "Save page");
  let saved = "";
  for (let i = 0; i < 100; i++) {
    try {
      saved = await Deno.readTextFile(`${downloads}/kernel-log-page.txt`);
    } catch { /* download in progress */ }
    if (saved === output) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assertEquals(saved, output, "save includes every byte of the displayed page");
  await clickButton(page, "Next");
  await waitForPage(
    page,
    `document.querySelector('textarea[data-bind="output"]')?.value === ''`,
    "bounded continuation reaches empty end",
  );
  await clickButton(page, "Recent");
  await waitForPage(
    page,
    `document.querySelector('textarea[data-bind="output"]')?.value.includes('development sandbox')`,
    "recent refresh",
  );
  await clickButton(page, "Refresh");
  await waitForPage(
    page,
    `document.querySelector('textarea[data-bind="output"]')?.value.includes('development sandbox')`,
    "refresh applied query",
  );
  await setValue(page, '[data-bind="node_id"]', "nod-0000000000");
  await clickButton(page, "Search");
  await waitForPage(
    page,
    `document.body.innerText.includes('Permission denied')`,
    "foreign-node application permission rejection",
  );
  console.log(
    "Diagnostics E2E passed: live catalog/dispatch, safe mutation/rejection, real host logs, exact browser copy/save, continuation, node-scoped authorization, and installed sandbox skill/token isolation.",
  );
}
