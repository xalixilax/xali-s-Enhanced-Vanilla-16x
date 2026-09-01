# CHANGELOG

## v2.0.0
### Changed
- Updated release version to 2.0.0.
- Switched pack metadata to the modern `supported_formats` format (1.21.1+).
- Started migrating legacy block and biome identifiers for current Minecraft versions.
- Removed unsupported barrel-based OptiFine content.
- Replaced `scripts/modernize-v2.ts` with `scripts/fix-v2.ts` (idempotent maintenance script) and added `scripts/validate-pack.ts`.

### Fix
- Fixed short_grass: double-replaced `short_short_grass` model/texture references and broken blockstate variants.
- Fixed dirt_path: missing `dirt_path.json` model and renamed `grass_path` texture folder so models resolve.
- Fixed trapdoor top template model referencing an invalid `block/#side` texture.
- Fixed `podzol` overlay properties where a trailing backslash merged `method=overlay` into `matchBlocks`.
- Fixed missing `particle` textures in vine models and `#missing`/particle references in mushroom models.
- Fixed snowy overlay properties referencing a non-existent `block/inv` tile and the `vin0_alt_1` typo.
- Removed `!snowy_taiga` invalid biome token and fixed the `terralith:wintry_lowlandss` typo.
- Removed junk files (`.DS_Store`, `.lnk`, files with spaces/uppercase) and the dead `fenceLog`/`fenceStrippedLog` folders.
- Migrated all legacy block ids (`concrete`, `planks`, `hardened_clay`, `silver_glazed_terracotta`, `stained_hardened_clay`, `cobblestone_mossy_*`) and legacy biome ids to modern equivalents.

## v1.11.0
### Fix
- Snowy azalea leaves
- Grass/Gravel overlays
- Fixed coarse_dirt, grass_block and snowoverlays

### Addition
-New textures for doors (items)

## v1.11.1
### Fix
- Removed CEM files that I added back by mistakes. Making many mobs having missing parts.

## v1.11.2
### Feature
- Updated pack format for 1.21