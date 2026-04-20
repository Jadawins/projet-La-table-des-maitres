import json, glob, os

EXPECTED = {
    "sword_2h":  ["walk", "hurt", "idle", "run", "jump", "slash", "thrust"],
    "sword_1h":  ["walk", "hurt", "idle", "run", "jump", "slash", "thrust",
                  "1h_slash", "1h_backslash", "1h_halfslash"],
    "blunt":     ["walk", "hurt", "idle", "run", "jump", "slash"],
    "polearm":   ["walk", "hurt", "idle", "run", "jump", "thrust"],
    "ranged":    ["walk", "hurt", "idle", "run", "jump", "shoot"],
    "magic":     ["walk", "hurt", "idle", "run", "jump", "spellcast"],
}

WEAPON_TYPES = {
    "longsword": "sword_2h", "katana": "sword_2h",
    "rapier": "sword_1h",    "dagger": "sword_1h", "saber": "sword_1h",
    "scimitar": "sword_1h",  "arming": "sword_1h",
    "mace": "blunt",         "club": "blunt",      "waraxe": "blunt", "flail": "blunt",
    "spear": "polearm",      "halberd": "polearm", "scythe": "polearm",
    "trident": "polearm",    "longspear": "polearm",
    "crossbow": "ranged",    "slingshot": "ranged", "bow": "ranged",
    "crystal": "magic",      "diamond": "magic",   "gnarled": "magic",
    "loop": "magic",         "wand": "magic",      "simple": "magic",
}

for json_file in glob.glob("sheet_definitions/weapons/**/*.json", recursive=True):
    name = os.path.basename(json_file).replace(".json","").replace("weapon_","")
    if name.startswith("meta"):
        continue
    category = next((v for k, v in WEAPON_TYPES.items() if k in name), None)
    if not category:
        continue
    with open(json_file) as f:
        data = json.load(f)
    defined = set(data.get("animations", []))
    ALIASES = {
        "slash_128":     "1h_slash",
        "backslash_128": "1h_backslash",
        "halfslash_128": "1h_halfslash",
        "attack_slash":  "slash",
        "attack_thrust": "thrust",
        "attack_backslash": "backslash",
    }
    normalized = set()
    for a in defined:
        a = a.replace("_oversize","").replace("_reverse","")
        a = ALIASES.get(a, a)
        normalized.add(a)
    defined = normalized
    missing = [a for a in EXPECTED[category] if a not in defined]
    if missing:
        print(f"[{category}] {name}: MANQUE {missing}")
