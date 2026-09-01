import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const rootDir = resolve(import.meta.dir, "..");
const mc = join(rootDir, "src", "assets", "minecraft");

function walk(dir: string, ext: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p, ext, out);
    } else if (entry.name.endsWith(ext)) {
      out.push(p);
    }
  }
  return out;
}

const errors: string[] = [];
const warnings: string[] = [];

const invalidPath = /[A-Z\s()!@#$%^&*+=[\]{};':",<>?`|~]/;
const allFiles = walk(mc, ".png").concat(walk(mc, ".json")).concat(walk(mc, ".properties")).concat(walk(mc, ".txt"));
for (const f of allFiles) {
  const rel = relative(mc, f);
  if (invalidPath.test(rel)) {
    errors.push(`Invalid resource path: ${relative(rootDir, f)}`);
  }
}

const modelFiles = new Set(walk(mc, ".json").filter((f) => f.includes("/models/")));
const blockstateFiles = walk(mc, ".json").filter((f) => f.includes("/blockstates/"));
const textureFiles = new Set(
  walk(mc, ".png").map((f) => f.replace(mc + "/textures/", "").replace(/\.png$/, ""))
);

function stripNamespace(id: string): string {
  return id.includes(":") ? id.slice(id.indexOf(":") + 1) : id;
}

for (const bsFile of blockstateFiles) {
  let data: any;
  try {
    data = JSON.parse(readFileSync(bsFile, "utf8"));
  } catch (e: any) {
    errors.push(`Bad JSON ${relative(rootDir, bsFile)}: ${e.message}`);
    continue;
  }
  const modelRefs: string[] = [];
  if (data.variants) {
    for (const variant of Object.values(data.variants)) {
      const list = Array.isArray(variant) ? variant : [variant];
      for (const entry of list) {
        if (entry && entry.model) modelRefs.push(entry.model);
      }
    }
  }
  if (data.multipart) {
    for (const part of data.multipart) {
      if (part.apply) {
        const list = Array.isArray(part.apply) ? part.apply : [part.apply];
        for (const entry of list) {
          if (entry && entry.model) modelRefs.push(entry.model);
        }
      }
    }
  }
  for (const ref of modelRefs) {
    const path = join(mc, "models", stripNamespace(ref) + ".json");
    if (!existsSync(path)) {
      warnings.push(`Blockstate ${relative(rootDir, bsFile)} uses vanilla model: ${ref}`);
    }
  }
}

for (const modelFile of modelFiles) {
  let data: any;
  try {
    data = JSON.parse(readFileSync(modelFile, "utf8"));
  } catch (e: any) {
    errors.push(`Bad JSON ${relative(rootDir, modelFile)}: ${e.message}`);
    continue;
  }
  if (data.parent) {
    const parent = String(data.parent);
    if (parent.startsWith("minecraft:") || !parent.startsWith("block/")) {
      continue;
    }
    const path = join(mc, "models", parent + ".json");
    if (!existsSync(path)) {
      warnings.push(`Model ${relative(rootDir, modelFile)} references missing parent: ${parent}`);
    }
  }
  if (data.textures) {
    for (const [key, value] of Object.entries(data.textures)) {
      const v = String(value);
      if (v.startsWith("#")) continue;
      const path = stripNamespace(v);
      if (!textureFiles.has(path)) {
        warnings.push(`Model ${relative(rootDir, modelFile)} references missing texture '${key}': ${v}`);
      }
    }
  }
}

const legacyBlockPatterns: Array<[RegExp, string]> = [
  [/(?<![a-z0-9_])concrete(?![a-z0-9_])/, "concrete"],
  [/(?<![a-z0-9_])planks(?![a-z0-9_])/, "planks"],
  [/(?<![a-z0-9_])hardened_clay(?![a-z0-9_])/, "hardened_clay"],
  [/(?<![a-z0-9_])silver_glazed_terracotta(?![a-z0-9_])/, "silver_glazed_terracotta"],
  [/(?<![a-z0-9_])stained_hardened_clay(?![a-z0-9_])/, "stained_hardened_clay"],
  [/(?<![a-z0-9_])cobblestone_mossy_(?![a-z0-9_])/, "cobblestone_mossy_*"],
  [/(?<![a-z0-9_])deepslate_old_ore(?![a-z0-9_])/, "deepslate_old_ore"]
];

const legacyBiomePatterns: Array<[RegExp, string]> = [
  [/(?<![a-z0-9_])snowy_tundra(?![a-z0-9_])/, "snowy_tundra"],
  [/(?<![a-z0-9_])snowy_mountains(?![a-z0-9_])/, "snowy_mountains"],
  [/(?<![a-z0-9_])snowy_taiga_hills(?![a-z0-9_])/, "snowy_taiga_hills"],
  [/(?<![a-z0-9_])snowy_taiga_mountains(?![a-z0-9_])/, "snowy_taiga_mountains"],
  [/(?<![a-z0-9_])deep_frozen_ocean(?![a-z0-9_])/, "deep_frozen_ocean"],
  [/(?<![a-z0-9_])deep_cold_ocean(?![a-z0-9_])/, "deep_cold_ocean"],
  [/(?<![a-z0-9_])deep_lukewarm_ocean(?![a-z0-9_])/, "deep_lukewarm_ocean"],
  [/(?<![a-z0-9_])deep_warm_ocean(?![a-z0-9_])/, "deep_warm_ocean"],
  [/(?<![a-z0-9_])stone_shore(?![a-z0-9_])/, "stone_shore"],
  [/(?<![a-z0-9_])shattered_savanna(?![a-z0-9_])/, "shattered_savanna"],
  [/(?<![a-z0-9_])giant_spruce_taiga(?![a-z0-9_])/, "giant_spruce_taiga"],
  [/(?<![a-z0-9_])jungle_edge(?![a-z0-9_])/, "jungle_edge"],
  [/(?<![a-z0-9_])modified_jungle(?![a-z0-9_])/, "modified_jungle"],
  [/(?<![a-z0-9_])badlands_plateau(?![a-z0-9_])/, "badlands_plateau"],
  [/(?<![a-z0-9_])wooded_badlands_plateau(?![a-z0-9_])/, "wooded_badlands_plateau"],
  [/(?<![a-z0-9_])desert_hills(?![a-z0-9_])/, "desert_hills"],
  [/(?<![a-z0-9_])desert_lakes(?![a-z0-9_])/, "desert_lakes"],
  [/(?<![a-z0-9_])dark_forest_hills(?![a-z0-9_])/, "dark_forest_hills"],
  [/(?<![a-z0-9_])birch_forest_hills(?![a-z0-9_])/, "birch_forest_hills"],
  [/(?<![a-z0-9_])taiga_hills(?![a-z0-9_])/, "taiga_hills"],
  [/(?<![a-z0-9_])taiga_mountains(?![a-z0-9_])/, "taiga_mountains"],
  [/(?<![a-z0-9_])bamboo_jungle_hills(?![a-z0-9_])/, "bamboo_jungle_hills"],
  [/(?<![a-z0-9_])mushroom_field_shore(?![a-z0-9_])/, "mushroom_field_shore"],
  [/(?<![a-z0-9_])giant_tree_taiga(?![a-z0-9_])/, "giant_tree_taiga"],
  [/(?<![a-z0-9_])gravelly_mountains(?![a-z0-9_])/, "gravelly_mountains"],
  [/(?<![a-z0-9_])wooded_mountains(?![a-z0-9_])/, "wooded_mountains"]
];

const propsFiles = walk(mc, ".properties");
for (const pf of propsFiles) {
  const source = readFileSync(pf, "utf8");
  const rel = relative(rootDir, pf);
  for (const [pattern, label] of legacyBlockPatterns) {
    if (pattern.test(source)) {
      errors.push(`Legacy block id '${label}' in ${rel}`);
    }
  }
  for (const [pattern, label] of legacyBiomePatterns) {
    if (pattern.test(source)) {
      errors.push(`Legacy biome id '${label}' in ${rel}`);
    }
  }
  if (source.includes("!snowy_taiga")) {
    errors.push(`Invalid '!snowy_taiga' biome token in ${rel}`);
  }
  if (source.includes("wintry_lowlandss")) {
    errors.push(`Typo 'terralith:wintry_lowlandss' in ${rel}`);
  }
  if (source.includes("short_short_grass")) {
    errors.push(`Double-replaced 'short_short_grass' in ${rel}`);
  }
  if (/[a-z0-9_/]+\s*=\s*[^\s][^=]*\\$/.test(source)) {
    const line = source.split(/\r?\n/).find((l) => l.endsWith("\\") && /=[^=]*\\$/.test(l));
    if (line) errors.push(`Trailing backslash in ${rel}`);
  }
  for (const line of source.split(/\r?\n/)) {
    const m = line.match(/^(matchTiles|tiles)=(.*)$/);
    if (m) continue;
  }
}

console.log(`=== Validation ===`);
console.log(`errors: ${errors.length}`);
for (const e of errors) console.log(`  [ERR] ${e}`);
const uniqueWarnings = [...new Set(warnings)];
console.log(`warnings: ${uniqueWarnings.length}`);
for (const w of uniqueWarnings.slice(0, 60)) console.log(`  [WARN] ${w}`);
if (uniqueWarnings.length > 60) console.log(`  ... and ${uniqueWarnings.length - 60} more`);
process.exit(errors.length ? 1 : 0);
