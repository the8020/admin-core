import { assert, assertEquals } from "@std/assert";
import type { NativeBrowserFixtureContext } from "../uui/browser_e2e.ts";

/** Exercise real Git fetch/activation through the ordinary Packages screen. */
export default async function verify(context: NativeBrowserFixtureContext) {
  const {
    page,
    admin,
    click,
    clickButton,
    clickRow,
    waitForPage,
    waitForScreen,
  } = context;
  const source = `${context.root}/update-fixture`;
  await Deno.mkdir(source);
  const git = async (...args: string[]) => {
    const result = await new Deno.Command("git", {
      cwd: source,
      args,
      stdout: "piped",
      stderr: "piped",
    }).output();
    if (!result.success) {
      throw new Error(new TextDecoder().decode(result.stderr));
    }
    return new TextDecoder().decode(result.stdout).trim();
  };
  await git("init", "-b", "main");
  await git("config", "user.name", "Package update fixture");
  await git("config", "user.email", "fixture@example.invalid");
  const release = async (version: string) => {
    await Deno.writeTextFile(
      `${source}/package.toml`,
      `schema = 1\ndescription = "Update fixture ${version}"\n`,
    );
    await git("add", "package.toml");
    await git("commit", "-m", version);
    await git("tag", "-a", version, "-m", version);
    await git("update-server-info");
    return await git("rev-parse", "HEAD");
  };
  const before = await release("0.1.0");
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen() {} },
    async (request) => {
      const path = new URL(request.url).pathname.replace(
        /^\/fixtures\/updates.git\//,
        "",
      );
      if (path.startsWith("/") || path.includes("..")) {
        return new Response(
          null,
          { status: 404 },
        );
      }
      try {
        const file = await Deno.open(`${source}/.git/${path}`);
        return new Response(file.readable);
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
          return new Response(null, {
            status: 404,
          });
        }
        throw error;
      }
    },
  );
  try {
    await admin(["auth.roles.create", "package-updates-fixture"]);
    await admin([
      "auth.roles.grant",
      "package-updates-fixture",
      "packages.*",
      "fixtures/*",
    ]);
    await admin([
      "auth.users.assign",
      context.credentials.username,
      "package-updates-fixture",
    ]);
    await admin([
      "packages.index.set",
      "fixtures/updates",
      "--source",
      `http://127.0.0.1:${server.addr.port}/fixtures/updates.git`,
      "--tag",
      "0.1.0",
    ]);
    await admin(["packages.synchronize", "--packages", "fixtures/updates"]);
    await admin(["packages.local.create", "fixtures/local"]);
    const after = await release("0.1.1");
    const installed = async () =>
      (await admin(["packages.repository.inspect", "fixtures/updates"]))
        .repository as { head: string };
    assertEquals((await installed()).head, before);
    await clickRow(page, "the8020/admin-core/packages");
    await waitForScreen(page, "Packages");
    const list = '[data-list-id="packages"]';
    await waitForPage(
      page,
      `document.querySelector(${
        JSON.stringify(list)
      })?.innerText.includes('fixtures/updates')`,
      "package rows",
    );
    const selected = (count: number) =>
      waitForPage(
        page,
        `document.querySelectorAll(${
          JSON.stringify(`${list} tbody .data-list-selection input:checked`)
        }).length === ${count}`,
        `${count} selected packages`,
      );
    await click(page, `${list} thead input[type=checkbox]`);
    await waitForPage(
      page,
      `(() => {
      const boxes = [...document.querySelectorAll(${
        JSON.stringify(`${list} tbody .data-list-selection input`)
      })];
      return boxes.length > 2 && boxes.every(box => box.checked);
    })()`,
      "Select all packages",
    );
    await click(page, `${list} thead input[type=checkbox]`);
    await selected(0);
    const select = async (id: string) => {
      assert(
        await page.evaluate<boolean>(`(() => {
        const row = [...document.querySelectorAll(${
          JSON.stringify(`${list} tbody tr`)
        })].find(row => row.innerText.includes(${JSON.stringify(id)}));
        const checkbox = row?.querySelector('.data-list-selection input');
        if (!checkbox) return false;
        checkbox.click(); return true;
      })()`),
      );
    };
    await select("fixtures/updates");
    await selected(1);
    await select("fixtures/local");
    await selected(2);
    const notice = async (text: string) => {
      try {
        await waitForPage(
          page,
          `document.body.innerText.includes(${JSON.stringify(text)})`,
          text,
          60_000,
        );
      } catch (error) {
        const messages = await page.evaluate<string>(
          "document.querySelector('#message-history-list')?.textContent ?? document.body.innerText",
        );
        throw new Error(
          `${
            error instanceof Error ? error.message : String(error)
          }; messages: ${messages.slice(-5000)}`,
        );
      }
    };
    await clickButton(page, "Fetch");
    await notice("Fetched 1; 0 up to date; 1 skipped; 0 failed");
    await selected(2);
    assertEquals(
      (await installed()).head,
      before,
      "Fetch must not activate code",
    );
    await waitForPage(
      page,
      `document.querySelector(${
        JSON.stringify(list)
      })?.querySelector('[data-material-icon="upgrade"]') !== null`,
      "blue update icon",
    );
    assert(
      await page.evaluate<boolean>(
        `!!document.querySelector(${
          JSON.stringify(list)
        })?.querySelector('[data-material-icon="cloud_off"]')`,
      ),
    );
    await clickButton(page, "Update");
    await notice("Updated 1; 0 up to date; 1 skipped; 0 failed");
    await selected(2);
    assertEquals((await installed()).head, after);
    await clickButton(page, "Update");
    await notice("Updated 0; 1 up to date; 1 skipped; 0 failed");
    await selected(2);
    const latest = await release("0.1.2");
    await select("fixtures/local");
    await selected(1);
    await clickButton(page, "Fetch");
    await notice("Fetched 1; 0 up to date; 0 skipped; 0 failed");
    await clickButton(page, "Update");
    await notice("Updated 1; 0 up to date; 0 skipped; 0 failed");
    await selected(1);
    assertEquals((await installed()).head, latest);
    await waitForPage(
      page,
      `document.querySelector(${
        JSON.stringify(list)
      })?.querySelector('[data-material-icon="check_circle"]') !== null`,
      "green current icon",
    );
    const screenshot = Deno.env.get("PACKAGE_UPDATES_SCREENSHOT");
    if (screenshot) {
      const capture = await page.command<{ data: string }>(
        "Page.captureScreenshot",
        { format: "png" },
      );
      await Deno.writeFile(
        screenshot,
        Uint8Array.from(atob(capture.data), (char) => char.charCodeAt(0)),
      );
    }
    await clickRow(page, "fixtures/updates");
    await waitForScreen(page, "Package fixtures/updates");
  } finally {
    await server.shutdown();
  }
}
