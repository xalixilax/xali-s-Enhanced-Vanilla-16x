import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const rootDir = resolve(import.meta.dir, "..");
const minecraftDir = join(rootDir, "src", "assets", "minecraft");
const optifineDir = join(rootDir, "src", "assets", "minecraft", "optifine");

const stringReplacements: Array<[string, string]> = [
  ["minecraft:block/grass", "minecraft:block/short_grass"],
  ["block/grass/", "block/short_grass/"],
  ["grass/grass_", "short_grass/short_grass_"],
  ["grass/grass", "short_grass/short_grass"],
  ["block/grass_path/", "block/dirt_path/"],
  ["block/grass_path_side", "block/dirt_path_side"],
  ["block/grass_path\"", "block/dirt_path\""]
];

const replacements: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /(?<![a-z0-9_])snowy_tundra(?![a-z0-9_])/g, replacement: "snowy_plains" },
  { pattern: /(?<![a-z0-9_])mushroom_field_shore(?![a-z0-9_])/g, replacement: "mushroom_fields" },
  { pattern: /(?<![a-z0-9_])wooded_hills(?![a-z0-9_])/g, replacement: "forest" },
  { pattern: /(?<![a-z0-9_])tall_birch_forest(?![a-z0-9_])/g, replacement: "old_growth_birch_forest" },
  { pattern: /(?<![a-z0-9_])tall_birch_hills(?![a-z0-9_])/g, replacement: "old_growth_birch_forest" },
  { pattern: /(?<![a-z0-9_])jungle_hills(?![a-z0-9_])/g, replacement: "jungle" },
  { pattern: /(?<![a-z0-9_])swamp_hills(?![a-z0-9_])/g, replacement: "swamp" },
  { pattern: /(?<![a-z0-9_])giant_tree_taiga_hills(?![a-z0-9_])/g, replacement: "old_growth_pine_taiga" },
  { pattern: /(?<![a-z0-9_])giant_tree_taiga(?![a-z0-9_])/g, replacement: "old_growth_pine_taiga" },
  { pattern: /(?<![a-z0-9_])wooded_mountains(?![a-z0-9_])/g, replacement: "windswept_forest" },
  { pattern: /(?<![a-z0-9_])modified_gravelly_mountains(?![a-z0-9_])/g, replacement: "windswept_gravelly_hills" },
  { pattern: /(?<![a-z0-9_])gravelly_mountains(?![a-z0-9_])/g, replacement: "windswept_gravelly_hills" },
  { pattern: /(?<![a-z0-9_])mountain_edge(?![a-z0-9_])/g, replacement: "windswept_hills" },
  { pattern: /(?<![a-z0-9_])mountains(?![a-z0-9_])/g, replacement: "windswept_hills" },
  { pattern: /(?<![a-z0-9_])grass_path(?!_[a-z0-9]|[a-z0-9])/g, replacement: "dirt_path" },
  { pattern: /(?<![a-z0-9_])grass(?!_block|_path|_roots|_top|_side|_overlay|\/[a-z0-9_]|[a-z0-9_])/g, replacement: "short_grass" },
  { pattern: /(?<![a-z0-9_])matchBlocks=grass_block_snow(?![a-z0-9_])/g, replacement: "matchBlocks=snow_block" },
  { pattern: /(?<![a-z0-9_])deepslate_old_ore(?![a-z0-9_])/g, replacement: "deepslate_gold_ore" }
];

const renamePairs = [
  [join(minecraftDir, "blockstates", "grass.json"), join(minecraftDir, "blockstates", "short_grass.json")],
  [join(minecraftDir, "blockstates", "grass_path.json"), join(minecraftDir, "blockstates", "dirt_path.json")],
  [join(minecraftDir, "models", "block", "grass.json"), join(minecraftDir, "models", "block", "short_grass.json")],
  [join(minecraftDir, "models", "block", "grass"), join(minecraftDir, "models", "block", "short_grass")],
  [join(minecraftDir, "models", "block", "grass_path"), join(minecraftDir, "models", "block", "dirt_path")],
  [join(minecraftDir, "textures", "block", "grass.png"), join(minecraftDir, "textures", "block", "short_grass.png")],
  [join(minecraftDir, "textures", "block", "grass"), join(minecraftDir, "textures", "block", "short_grass")]
] as const;

const barrelPaths = [
  join(optifineDir, "cit", "barrel"),
  join(optifineDir, "ctm", "barrel"),
  join(optifineDir, "ctm", "bookshelf"),
  join(optifineDir, "cit", "bookshelf")
];

const textExtensions = new Set([".json", ".mcmeta", ".properties", ".txt", ".fsh", ".vsh", ".glsl"]);
const checkOnly = process.argv.includes("--check");

function walk(dirPath: string, filePaths: string[] = []): string[] {
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(entryPath, filePaths);
      continue;
    }

    for (const extension of textExtensions) {
      if (entry.name.endsWith(extension)) {
        filePaths.push(entryPath);
        break;
      }
    }
  }

  return filePaths;
}

function applyReplacements(source: string): string {
  let current = source;

  for (const [from, to] of stringReplacements) {
    current = current.split(from).join(to);
  }

  for (const { pattern, replacement } of replacements) {
    current = current.replace(pattern, replacement);
  }

  return current;
}

function ensureParentDir(filePath: string): void {
  mkdirSync(resolve(filePath, ".."), { recursive: true });
}

function applyRenames(): string[] {
  const renamedPaths: string[] = [];

  for (const [fromPath, toPath] of renamePairs) {
    if (!existsSync(fromPath)) {
      continue;
    }

    renamedPaths.push(`${relative(rootDir, fromPath)} -> ${relative(rootDir, toPath)}`);
    if (checkOnly) {
      continue;
    }

    ensureParentDir(toPath);
    renameSync(fromPath, toPath);
  }

  return renamedPaths;
}

const renamedPaths = applyRenames();
const changedFiles: string[] = [];
for (const filePath of existsSync(minecraftDir) ? walk(minecraftDir) : []) {
  const original = readFileSync(filePath, "utf8");
  const updated = applyReplacements(original);
  if (updated === original) {
    continue;
  }

  changedFiles.push(relative(rootDir, filePath));
  if (!checkOnly) {
    writeFileSync(filePath, updated, "utf8");
  }
}

const removablePaths = barrelPaths.filter((dirPath) => existsSync(dirPath));
if (!checkOnly) {
  for (const dirPath of removablePaths) {
    rmSync(dirPath, { force: true, recursive: true });
  }
}

const report = {
  mode: checkOnly ? "check" : "apply",
  changedFiles,
  renamedPaths,
  removedPaths: removablePaths.map((dirPath) => relative(rootDir, dirPath)),
  summary: {
    changedFileCount: changedFiles.length,
    renamedPathCount: renamedPaths.length,
    removedPathCount: removablePaths.length
  }
};

if (checkOnly) {
  const remaining = changedFiles.length > 0 || removablePaths.length > 0;
  console.log(JSON.stringify({ ...report, remaining }, null, 2));
  process.exit(remaining ? 1 : 0);
}

writeFileSync(join(rootDir, ".tmp", "modernize_v2_report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify(report, null, 2));