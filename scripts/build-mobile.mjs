// Static export for the Capacitor Android app.
// Route handlers (app/api) cannot be part of a static export, so they are moved aside for the
// duration of the build and always restored afterwards. The native app calls them on the
// deployed web backend via NEXT_PUBLIC_API_BASE_URL instead.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDirectory = path.join(root, "app", "api");
const stashDirectory = path.join(root, ".mobile-build-stash");
const stashedApi = path.join(stashDirectory, "api");

const restore = () => {
  if (existsSync(stashedApi) && !existsSync(apiDirectory)) {
    renameSync(stashedApi, apiDirectory);
    console.log("app/api wiederhergestellt.");
  }
};

// Recover from an interrupted earlier run first.
restore();

let exitCode = 1;
try {
  if (existsSync(apiDirectory)) {
    mkdirSync(stashDirectory, { recursive: true });
    renameSync(apiDirectory, stashedApi);
  }
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  const result = spawnSync(process.execPath, [nextBin, "build"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, LINGO_MOBILE_BUILD: "1" },
  });
  exitCode = result.status ?? 1;
} finally {
  restore();
}

if (exitCode === 0) console.log("Static Export für Android liegt in out/. Weiter mit: npx cap sync android");
process.exit(exitCode);
