#!/usr/bin/env python3

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
ASSETS = SRC / "assets"
MINECRAFT = ASSETS / "minecraft"
TMP = ROOT / ".tmp"


TEXT_EXTENSIONS = {".json", ".mcmeta", ".properties", ".txt", ".fsh", ".vsh", ".glsl"}

STALE_PATTERNS = {
    "legacy_block_grass": re.compile(r"(?<![a-z0-9_])grass(?!_block|_path|_roots|_top|_side|_overlay|[a-z0-9_])"),
    "legacy_block_grass_path": re.compile(r"(?<![a-z0-9_])grass_path(?![a-z0-9_])"),
    "legacy_block_deepslate_old_ore": re.compile(r"(?<![a-z0-9_])deepslate_old_ore(?![a-z0-9_])"),
    "legacy_biome_snowy_tundra": re.compile(r"(?<![a-z0-9_])snowy_tundra(?![a-z0-9_])"),
    "legacy_biome_mushroom_field_shore": re.compile(r"(?<![a-z0-9_])mushroom_field_shore(?![a-z0-9_])"),
    "legacy_biome_wooded_hills": re.compile(r"(?<![a-z0-9_])wooded_hills(?![a-z0-9_])"),
    "legacy_biome_tall_birch_forest": re.compile(r"(?<![a-z0-9_])tall_birch_forest(?![a-z0-9_])"),
    "legacy_biome_tall_birch_hills": re.compile(r"(?<![a-z0-9_])tall_birch_hills(?![a-z0-9_])"),
    "legacy_biome_jungle_hills": re.compile(r"(?<![a-z0-9_])jungle_hills(?![a-z0-9_])"),
    "legacy_biome_swamp_hills": re.compile(r"(?<![a-z0-9_])swamp_hills(?![a-z0-9_])"),
    "legacy_biome_giant_tree_taiga": re.compile(r"(?<![a-z0-9_])giant_tree_taiga(?![a-z0-9_])"),
    "legacy_biome_giant_tree_taiga_hills": re.compile(r"(?<![a-z0-9_])giant_tree_taiga_hills(?![a-z0-9_])"),
    "legacy_biome_mountains": re.compile(r"(?<![a-z0-9_])mountains(?![a-z0-9_])"),
    "legacy_biome_wooded_mountains": re.compile(r"(?<![a-z0-9_])wooded_mountains(?![a-z0-9_])"),
    "legacy_biome_gravelly_mountains": re.compile(r"(?<![a-z0-9_])gravelly_mountains(?![a-z0-9_])"),
    "legacy_biome_modified_gravelly_mountains": re.compile(r"(?<![a-z0-9_])modified_gravelly_mountains(?![a-z0-9_])"),
    "legacy_biome_mountain_edge": re.compile(r"(?<![a-z0-9_])mountain_edge(?![a-z0-9_])"),
}


def iter_text_files(base: Path):
    for path in base.rglob("*"):
        if path.is_file() and path.suffix in TEXT_EXTENSIONS:
            yield path


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def classify_path(path: Path) -> str:
    rel = relative(path)
    if "/optifine/" in rel:
        return "optifine_only"
    return "vanilla_baseline"


def scan_stale_identifiers() -> dict:
    findings = []
    counts = Counter()

    for path in iter_text_files(SRC):
        rel = relative(path)
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except UnicodeDecodeError:
            lines = path.read_text(encoding="latin-1").splitlines()

        for line_no, line in enumerate(lines, start=1):
            for label, pattern in STALE_PATTERNS.items():
                if pattern.search(line):
                    finding = {
                        "category": classify_path(path),
                        "pattern": label,
                        "file": rel,
                        "line": line_no,
                        "text": line.strip(),
                    }
                    findings.append(finding)
                    counts[(finding["category"], label)] += 1

    return {
        "findings": findings,
        "counts": [
            {
                "category": category,
                "pattern": pattern,
                "count": count,
            }
            for (category, pattern), count in sorted(counts.items())
        ],
    }


def scan_structure() -> dict:
    optifine_files = [relative(p) for p in (MINECRAFT / "optifine").rglob("*") if p.is_file()] if (MINECRAFT / "optifine").exists() else []
    blockstate_files = [relative(p) for p in (MINECRAFT / "blockstates").glob("*.json")] if (MINECRAFT / "blockstates").exists() else []
    model_files = [relative(p) for p in (MINECRAFT / "models").rglob("*.json")] if (MINECRAFT / "models").exists() else []
    texture_files = [relative(p) for p in (MINECRAFT / "textures").rglob("*.png")] if (MINECRAFT / "textures").exists() else []

    return {
        "optifine_file_count": len(optifine_files),
        "blockstate_count": len(blockstate_files),
        "model_count": len(model_files),
        "texture_count": len(texture_files),
        "sample_optifine_files": optifine_files[:50],
    }


def scan_pack_mcmeta() -> dict:
    pack_path = SRC / "pack.mcmeta"
    data = json.loads(pack_path.read_text(encoding="utf-8-sig"))
    pack = data.get("pack", {})
    return {
        "file": relative(pack_path),
        "pack_format": pack.get("pack_format"),
        "supported_formats": pack.get("supported_formats"),
        "uses_modern_min_max_format": "min_format" in pack or "max_format" in pack,
    }


def write_json(name: str, payload: dict) -> None:
    path = TMP / name
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def write_summary(structure: dict, mcmeta: dict, stale: dict) -> None:
    vanilla = [f for f in stale["findings"] if f["category"] == "vanilla_baseline"]
    optifine = [f for f in stale["findings"] if f["category"] == "optifine_only"]
    vanilla_counts = Counter(f["pattern"] for f in vanilla)
    optifine_counts = Counter(f["pattern"] for f in optifine)

    lines = [
        "No-OptiFine modernization audit",
        "",
        f"pack.mcmeta uses modern min/max format: {mcmeta['uses_modern_min_max_format']}",
        f"pack.mcmeta pack_format: {mcmeta['pack_format']}",
        f"optifine file count: {structure['optifine_file_count']}",
        f"vanilla-baseline stale identifier matches: {len(vanilla)}",
        f"optifine-only stale identifier matches: {len(optifine)}",
        "",
        "Vanilla baseline stale identifiers:",
    ]

    if vanilla_counts:
        for pattern, count in sorted(vanilla_counts.items()):
            lines.append(f"- {pattern}: {count}")
    else:
        lines.append("- none")

    lines.extend([
        "",
        "OptiFine-only stale identifiers:",
    ])

    if optifine_counts:
        for pattern, count in sorted(optifine_counts.items()):
            lines.append(f"- {pattern}: {count}")
    else:
        lines.append("- none")

    lines.extend([
        "",
        "Interpretation:",
        "- If OptiFine content is removed or replaced, only the vanilla-baseline matches remain as required modernization work.",
        "- The optifine/ tree still contains most stale block and biome identifiers in this pack.",
    ])

    (TMP / "no_optifine_summary.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    TMP.mkdir(exist_ok=True)
    structure = scan_structure()
    mcmeta = scan_pack_mcmeta()
    stale = scan_stale_identifiers()

    write_json("no_optifine_structure.json", structure)
    write_json("no_optifine_pack_mcmeta.json", mcmeta)
    write_json("no_optifine_stale_identifiers.json", stale)
    write_summary(structure, mcmeta, stale)


if __name__ == "__main__":
    main()
