const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// The native app shares the framework-free learning logic and the language packs with the web app
// (../app/lib, ../public/packs). Only those folders are watched; dependencies always come from mobile/node_modules.
config.watchFolders = [path.join(repoRoot, "app", "lib"), path.join(repoRoot, "public", "packs")];
config.resolver.nodeModulesPaths = [path.join(projectRoot, "node_modules")];

module.exports = withNativeWind(config, { input: "./global.css" });
