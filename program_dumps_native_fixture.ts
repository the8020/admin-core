import { assert, assertEquals } from "@std/assert";
import type { NativeBrowserFixtureContext } from "../uui/browser_e2e.ts";

export default async function verify(c: NativeBrowserFixtureContext) {
  const { page, admin, waitForPage, waitForScreen, clickButton, clickRow } = c;
  const username = c.credentials.username;
  const program = "the8020/demo/demo-form";
  const archive = "the8020/admin-core/program-dumps";
  const table = "the8020__admin_core__program_dumps";

  await clickRow(page, program);
  await waitForScreen(page, "Form and binding demonstration");
  await clickButton(page, "Throw TypeError");
  await waitForScreen(page, "Program terminated");

  const { rows } = await admin([
    "db.sql",
    `SELECT "username", "programId", "heading", "dumpText"
     FROM ${table}`,
  ]);
  assert(Array.isArray(rows) && rows.length === 1);
  const [user, id, heading, dump] = rows[0] as string[];
  assertEquals([user, id], [username, program]);
  assert(heading?.includes("TypeError") && heading.includes("demo-form"));
  assert(dump && dump.includes("intentionally raised an uncaught TypeError"));
  assert(dump.includes("CALL STACK") && dump.includes("raiseDemoTypeError"));

  await clickButton(page, "Home");
  await waitForScreen(page, "Welcome to 80|20");
  assert(
    !await page.evaluate<boolean>(
      `document.querySelector('[data-tile-id="${archive}"]') !== null`,
    ),
  );
  await admin(["auth.roles.create", "dump-reader"]);
  await admin([
    "auth.roles.grant",
    "dump-reader",
    "the8020.admin-core.program-dumps.view",
    "*",
  ]);
  await admin(["auth.users.assign", username, "dump-reader"]);

  const oldDump = "Legacy report without newer fields";
  const yesterday = new Date(Date.now() - 86_400_000).toISOString();
  await admin([
    "db.sql",
    `INSERT INTO ${table} ("id", "username", "programId", "heading", "occurredAt", "dumpText")
     VALUES ($1, $2, $3, $4, $5, $6)`,
    "--parameters",
    JSON.stringify([
      "older",
      username,
      program,
      "Legacy heading",
      yesterday,
      oldDump,
    ]),
  ]);

  await clickButton(page, "Refresh");
  await clickRow(page, archive);
  await waitForScreen(page, "Program dumps");
  await c.setValue(page, 'input[data-bind="username"]', username);
  await c.setValue(page, 'input[data-bind="programId"]', program);
  await clickButton(page, "Today");
  await waitForPage(
    page,
    `!document.documentElement.hasAttribute('data-interaction-pending') &&
      document.querySelector('[data-list-id="dumps"] tbody tr')?.textContent.includes("TypeError")`,
    "today’s captured dump",
  );
  await clickRow(page, "TypeError");
  await waitForScreen(page, "Program terminated");
  assertEquals(
    await page.evaluate(
      `document.querySelector('textarea[data-bind="dumpText"]')?.value`,
    ),
    dump,
  );
  await clickButton(page, "Back");
  await waitForScreen(page, "Program dumps");
  await waitForPage(
    page,
    `!!document.querySelector('[data-list-id="dumps"]')`,
    "retained list",
  );
  await clickButton(page, "Back");
  await waitForPage(
    page,
    `!!document.querySelector('input[data-bind="from"]')`,
    "selection criteria",
  );
  await clickButton(page, "Yesterday");
  await waitForPage(
    page,
    `!document.documentElement.hasAttribute('data-interaction-pending') &&
      document.querySelector('[data-list-id="dumps"] tbody tr')?.textContent.includes("Legacy heading")`,
    "yesterday’s archived dump",
  );
  await clickRow(page, "Legacy heading");
  await waitForScreen(page, "Program terminated");
  assertEquals(
    await page.evaluate(
      `document.querySelector('textarea[data-bind="dumpText"]')?.value`,
    ),
    oldDump,
  );
}
