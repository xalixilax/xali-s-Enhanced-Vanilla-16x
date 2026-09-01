import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { join, relative, resolve } from "node:path";

const rootDir = resolve(import.meta.dir, "..");
const minecraftDir = join(rootDir, "src", "assets", "minecraft");
const optifineDir = join(minecraftDir, "optifine");
const checkOnly = process.argv.includes("--check");

const plankVariants = ["oak_planks", "spruce_planks", "birch_planks", "jungle_planks", "acacia_planks", "dark_oak_planks"];
const terracottaColors = [
  "white_terracotta", "orange_terracotta", "magenta_terracotta", "light_blue_terracotta",
  "yellow_terracotta", "lime_terracotta", "pink_terracotta", "gray_terracotta",
  "light_gray_terracotta", "cyan_terracotta", "purple_terracotta", "blue_terracotta",
  "brown_terracotta", "green_terracotta", "red_terracotta", "black_terracotta"
];

const wordRepl: Array<[string, string]> = [
  ["modified_wooded_badlands_plateau", "wooded_badlands"],
  ["modified_badlands_plateau", "badlands"],
  ["wooded_badlands_plateau", "wooded_badlands"],
  ["badlands_plateau", "badlands"],
  ["shattered_savanna_plateau", "windswept_savanna"],
  ["shattered_savanna", "windswept_savanna"],
  ["giant_spruce_taiga_hills", "old_growth_spruce_taiga"],
  ["giant_spruce_taiga", "old_growth_spruce_taiga"],
  ["modified_jungle_edge", "sparse_jungle"],
  ["modified_jungle", "jungle"],
  ["jungle_edge", "sparse_jungle"],
  ["bamboo_jungle_hills", "bamboo_jungle"],
  ["deep_frozen_ocean", "frozen_ocean"],
  ["deep_cold_ocean", "cold_ocean"],
  ["deep_lukewarm_ocean", "lukewarm_ocean"],
  ["deep_warm_ocean", "warm_ocean"],
  ["stone_shore", "stony_shore"],
  ["birch_forest_hills", "birch_forest"],
  ["dark_forest_hills", "dark_forest"],
  ["taiga_mountains", "taiga"],
  ["taiga_hills", "taiga"],
  ["snowy_taiga_mountains", "snowy_taiga"],
  ["snowy_taiga_hills", "snowy_taiga"],
  ["snowy_mountains", "snowy_slopes"],
  ["desert_lakes", "desert"],
  ["desert_hills", "desert"]
];

const legacyBlockRepl: Array<[string, string]> = [
  ["concrete", ""],
  ["planks", plankVariants.join(" ")],
  ["hardened_clay", "terracotta"],
  ["silver_glazed_terracotta", "light_gray_glazed_terracotta"],
  ["stained_hardened_clay", terracottaColors.join(" ")]
];

const plainRepl: Array<[string, string]> = [
  ["short_short_grass/short_grass", "short_grass/grass"],
  ["tiles=block/inv", "tiles=inv"],
  ["short_grass/short_grass", "block/short_grass/grass"],
  ["vin0_alt_1", "vine0_alt_1"],
  ["terralith:wintry_lowlandss", "terralith:wintry_lowlands"]
];

const textExtensions = new Set([".json", ".mcmeta", ".properties", ".txt", ".fsh", ".vsh", ".glsl"]);

const junkFiles = [
  join(minecraftDir, "textures", "block", "Sans-titre-1.png"),
  join(optifineDir, "ctm", "_overlays", "grass_block", "grass_block - Raccourci.lnk"),
  join(optifineDir, "ctm", "_overlays", "snowy_flowers", "snowy_fern (2).png"),
  join(optifineDir, "ctm", "_overlays", "snowy_flowers", "rose_bush_bottom winter.png"),
  join(optifineDir, "ctm", "_overlays", "z-deepslate", "Unused"),
  join(minecraftDir, "blockstates", "fenceLog"),
  join(minecraftDir, "blockstates", "fenceStrippedLog"),
  join(minecraftDir, "models", "block", "fenceLog"),
  join(minecraftDir, "models", "block", "fenceStrippedLog")
];

function walk(dirPath: string, filePaths: string[] = []): string[] {
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(entryPath, filePaths);
      continue;
    }
    if (entry.name === ".DS_Store" || entry.name.endsWith(".rpo")) {
      filePaths.push(entryPath);
      continue;
    }
    for (const ext of textExtensions) {
      if (entry.name.endsWith(ext)) {
        filePaths.push(entryPath);
        break;
      }
    }
  }
  return filePaths;
}

function wordWrap(from: string): string {
  return `(?<![a-z0-9_])${from}(?![a-z0-9_])`;
}

function applyGlobalTextReplacements(source: string): string {
  let current = source;

  for (const [from, to] of plainRepl) {
    current = current.split(from).join(to);
  }

  for (const [from, to] of wordRepl) {
    current = current.replace(new RegExp(wordWrap(from), "g"), to);
  }

  for (const [from, to] of legacyBlockRepl) {
    current = current.replace(new RegExp(wordWrap(from), "g"), to);
  }

  current = current.replace(new RegExp(wordWrap("cobblestone_mossy_(?:beach|birch|coldbeach|darkoak|desert|extremehills|forest|iceplains|jungle|mushroom|plains|swamp|taiga)"), "g"), "");

  current = current.split("!snowy_taiga").join("");

  return current;
}

const ctmValueKeys = new Set(["matchBlocks", "biomes", "matchTiles", "tiles", "connectBlocks", "connectTiles"]);

function normalizePropertiesFile(source: string): string {
  const lines = source.split(/\r?\n/);

  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].endsWith("\\") && /^[a-zA-Z0-9_.]+=/.test(lines[i + 1])) {
      lines[i] = lines[i].slice(0, -1);
    }
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const eqIndex = line.indexOf("=");
    if (eqIndex > 0) {
      const key = line.slice(0, eqIndex).trim();
      const value = line.slice(eqIndex + 1).trim();
      if (ctmValueKeys.has(key) && value.length > 0) {
        const tokens = value.replace(/\\/g, " ").split(/\s+/).filter(Boolean);
        const deduped = [...new Set(tokens)];
        if (deduped.length > 0) {
          line = `${key}=${deduped.join(" ")}`;
        }
      }
    }
    lines[i] = line;
  }

  return lines.join("\n");
}

function removeJunk(): string[] {
  const removed: string[] = [];
  const toRemove = [...junkFiles];
  for (const entry of walk(minecraftDir)) {
    if (entry.endsWith(".DS_Store") || entry.endsWith(".rpo")) {
      toRemove.push(entry);
    }
  }
  for (const target of toRemove) {
    if (existsSync(target)) {
      removed.push(relative(rootDir, target));
      if (!checkOnly) {
        const st = statSync(target);
        rmSync(target, { force: true, recursive: st.isDirectory() });
      }
    }
  }
  return removed;
}

function renameGrassPathTextures(): string[] {
  const fromDir = join(minecraftDir, "textures", "block", "grass_path");
  const toDir = join(minecraftDir, "textures", "block", "dirt_path");
  const renames: string[] = [];
  if (existsSync(fromDir)) {
    renames.push(`${relative(rootDir, fromDir)} -> ${relative(rootDir, toDir)}`);
    if (!checkOnly) {
      mkdirSync(toDir, { recursive: true });
      for (const file of readdirSync(fromDir)) {
        renameSync(join(fromDir, file), join(toDir, file));
      }
      rmSync(fromDir, { force: true, recursive: true });
    }
  }
  return renames;
}

function ensureDirtPathModel(): string[] {
  const source = join(minecraftDir, "models", "block", "dirt_path", "grass_path_0.json");
  const target = join(minecraftDir, "models", "block", "dirt_path.json");
  const created: string[] = [];
  if (existsSync(source) && !existsSync(target)) {
    created.push(relative(rootDir, target));
    if (!checkOnly) {
      writeFileSync(target, readFileSync(source, "utf8"), "utf8");
    }
  }
  return created;
}

function fixTrapdoorTemplate(): string[] {
  const target = join(minecraftDir, "models", "block", "trapdoor", "template_trapdoor_top.json");
  const fixed: string[] = [];
  if (existsSync(target)) {
    const source = readFileSync(target, "utf8");
    let updated = source;
    updated = updated.split(',\n\t\t"side": "block/#side"').join("");
    updated = updated.split(',\t\t"side": "block/#side"').join("");
    updated = updated.split('"side": "block/#side",\n').join("");
    updated = updated.split('"side": "block/#side"').join("");
    if (updated !== source) {
      fixed.push(relative(rootDir, target));
      if (!checkOnly) {
        writeFileSync(target, updated, "utf8");
      }
    }
  }
  return fixed;
}

function addParticleToModel(target: string, particle: string): string[] {
  const fixed: string[] = [];
  if (!existsSync(target)) {
    return fixed;
  }
  const source = readFileSync(target, "utf8");
  if (source.includes('"particle"')) {
    return fixed;
  }
  const texturesOpen = source.indexOf('"textures"');
  if (texturesOpen === -1) {
    return fixed;
  }
  const brace = source.indexOf("{", texturesOpen);
  if (brace === -1) {
    return fixed;
  }
  const next = brace + 1;
  const updated = source.slice(0, next) + `\n\t\t"particle": "${particle}",` + source.slice(next);
  if (updated !== source) {
    fixed.push(relative(rootDir, target));
    if (!checkOnly) {
      writeFileSync(target, updated, "utf8");
    }
  }
  return fixed;
}

function fixModels(): string[] {
  const fixed: string[] = [];
  for (const [file, particle] of [
    ["vine_3", "block/vine"],
    ["vine_3u", "block/vine"],
    ["vine_4", "block/vine"],
    ["vine_4u", "block/vine"]
  ] as Array<[string, string]>) {
    fixed.push(...addParticleToModel(join(minecraftDir, "models", "block", "vine", `${file}.json`), particle));
  }
  fixed.push(...addParticleToModel(join(minecraftDir, "models", "block", "mushroom", "red_mushroom_1.json"), "block/red_mushroom"));

  for (const file of ["red_mushroom_3", "crimson_fungus_3"]) {
    const target = join(minecraftDir, "models", "block", "mushroom", `${file}.json`);
    if (existsSync(target)) {
      const source = readFileSync(target, "utf8");
      const updated = source.split('"texture": "#missing"').join('"texture": "#0"');
      if (updated !== source) {
        fixed.push(relative(rootDir, target));
        if (!checkOnly) {
          writeFileSync(target, updated, "utf8");
        }
      }
    }
  }
  return fixed;
}

const removed = removeJunk();
const renames = renameGrassPathTextures();
const created = ensureDirtPathModel();
const trapdoorFixed = fixTrapdoorTemplate();
const modelFixed = fixModels();

const changedTextFiles: string[] = [];
for (const filePath of existsSync(minecraftDir) ? walk(minecraftDir) : []) {
  const isProperties = filePath.endsWith(".properties");
  const original = readFileSync(filePath, "utf8");
  let updated = applyGlobalTextReplacements(original);
  if (isProperties) {
    updated = normalizePropertiesFile(updated);
  }
  if (updated !== original) {
    changedTextFiles.push(relative(rootDir, filePath));
    if (!checkOnly) {
      writeFileSync(filePath, updated, "utf8");
    }
  }
}

const report = {
  mode: checkOnly ? "check" : "apply",
  removedPaths: removed,
  renamedPaths: renames,
  createdPaths: created,
  trapdoorFixed,
  modelFixed,
  changedTextFiles,
  summary: {
    removedCount: removed.length,
    renamedCount: renames.length,
    createdCount: created.length,
    trapdoorFixedCount: trapdoorFixed.length,
    modelFixedCount: modelFixed.length,
    changedTextFileCount: changedTextFiles.length
  }
};

if (checkOnly) {
  const remaining =
    removed.length > 0 ||
    renames.length > 0 ||
    created.length > 0 ||
    trapdoorFixed.length > 0 ||
    modelFixed.length > 0 ||
    changedTextFiles.length > 0;
  console.log(JSON.stringify({ ...report, remaining }, null, 2));
  process.exit(remaining ? 1 : 0);
}

writeFileSync(join(rootDir, ".tmp", "fix_v2_report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify(report, null, 2));
