import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { startMockApi } from "./mock-api.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const scratchRoot = join(root, ".browser-tests");
const next = join(root, "node_modules/next/dist/bin/next");
const playwright = join(root, "node_modules/@playwright/test/cli.js");
const processes = new Set();
const excluded = new Set([".git", ".next", ".browser-tests", "node_modules", "test-results", "playwright-report"]);

function command(script, args, options) {
  const child = spawn(process.execPath, [script, ...args], { stdio: "inherit", ...options });
  processes.add(child);
  child.once("exit", () => processes.delete(child));
  return child;
}

function completed(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`Command exited ${code ?? signal}`)));
  });
}

async function availablePort() {
  const reservation = createServer();
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  return port;
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  const timer = setTimeout(() => child.kill("SIGKILL"), 5_000);
  await exited;
  clearTimeout(timer);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    for (const child of processes) child.kill(signal);
    process.exit(signal === "SIGINT" ? 130 : 143);
  });
}

await mkdir(scratchRoot, { recursive: true });
const workspace = await mkdtemp(join(scratchRoot, "campaign-"));
const api = await startMockApi();
try {
  // Copy the actual app, excluding local secrets and generated output. Production config
  // remains untouched: the nested-path build wraps its copied Next.js config only.
  for (const entry of await readdir(root)) {
    if (excluded.has(entry) || entry.startsWith(".env") || entry.endsWith(".tsbuildinfo")) continue;
    await cp(join(root, entry), join(workspace, entry), { recursive: true });
  }
  await symlink(join(root, "node_modules"), join(workspace, "node_modules"), "junction");
  await rename(join(workspace, "next.config.ts"), join(workspace, "next.config.original.ts"));

  for (const basePath of ["", "/careers"]) {
    console.log(`\nBrowser regression: ${basePath || "/"}`);
    await writeFile(join(workspace, "next.config.ts"), `import config from "./next.config.original";\nexport default { ...config, basePath: ${JSON.stringify(basePath)} };\n`);
    await rm(join(workspace, ".next"), { recursive: true, force: true });
    const env = {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      STARTUPKIT_SECRET_KEY: "sk_browser_fixture",
      STARTUPKIT_BASE_URL: api.url,
      NEXT_PUBLIC_STARTUPKIT_PUBLISHABLE_KEY: "",
      NEXT_PUBLIC_STARTUPKIT_BASE_URL: api.url,
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
    };
    await completed(command(next, ["build", "--webpack"], { cwd: workspace, env }));
    const port = await availablePort();
    const siteUrl = `http://127.0.0.1:${port}`;
    const app = command(next, ["start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: workspace, env });
    try {
      const deadline = Date.now() + 30_000;
      while (true) {
        if (app.exitCode !== null) throw new Error("Next.js server exited before readiness.");
        try {
          if ((await fetch(`${siteUrl}${basePath}/`)).ok) break;
        } catch { /* Wait for the production server to bind its local port. */ }
        if (Date.now() > deadline) throw new Error("Next.js server did not become ready.");
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      await completed(command(playwright, ["test"], {
        cwd: root,
        env: { ...env, KIT_TEST_SITE_URL: siteUrl, KIT_TEST_API_URL: api.url, KIT_TEST_BASE_PATH: basePath },
      }));
    } finally {
      await stop(app);
    }
  }
} finally {
  for (const child of processes) await stop(child);
  api.server.closeAllConnections();
  await new Promise((resolve) => api.server.close(resolve));
  await rm(workspace, { recursive: true, force: true });
  await rm(dirname(workspace), { recursive: false, force: true }).catch(() => {});
}
