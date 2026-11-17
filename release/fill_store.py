# -*- coding: utf-8 -*-
"""Prepare store assets and fill TapTap store fields via CLI."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(r"d:\Program Files\code\new_game")
os.chdir(ROOT)
CLI = r"C:\Users\11358\AppData\Roaming\npm\node_modules\@taptap\cli\scripts\run.js"
DEV, APP = "522806", "1071466"
OUT = ROOT / "release"
OUT.mkdir(exist_ok=True)


def run_cli(args: list[str]) -> dict:
    r = subprocess.run(
        ["node", CLI, *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    text = r.stdout or r.stderr
    try:
        return json.loads(text)
    except Exception:
        print("CLI_FAIL", args, text[:800])
        raise


def write_json(path: Path, obj) -> None:
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def get_module(module_id: str) -> dict:
    p = OUT / f"mod-{module_id}.json"
    write_json(p, {"module_id": module_id})
    d = run_cli(["app", "get-module", "--dev-id", DEV, "--app-id", APP, "--data", f"@{p.as_posix()}"])
    return d["data"]["result"]


def upload_image(path: Path, key: str) -> dict:
    d = run_cli(
        [
            "upload",
            str(path.as_posix()),
            "--dev-id",
            DEV,
            "--app-id",
            APP,
            "--idempotency-key",
            key,
            "--yes",
        ]
    )
    if not d.get("ok"):
        raise RuntimeError(d)
    data = d["data"]
    return {"url": data["url"], "info": data["info"]}


def fit_cover(im: Image.Image, w: int, h: int) -> Image.Image:
    src = im.convert("RGB")
    scale = max(w / src.width, h / src.height)
    nw, nh = int(src.width * scale + 0.5), int(src.height * scale + 0.5)
    resized = src.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - w) // 2
    top = (nh - h) // 2
    return resized.crop((left, top, left + w, top + h))


def fit_contain_pad(im: Image.Image, w: int, h: int, bg=(245, 247, 250)) -> Image.Image:
    src = im.convert("RGB")
    scale = min(w / src.width, h / src.height)
    nw, nh = int(src.width * scale + 0.5), int(src.height * scale + 0.5)
    resized = src.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (w, h), bg)
    canvas.paste(resized, ((w - nw) // 2, (h - nh) // 2))
    return canvas


def prepare_assets() -> dict[str, Path]:
    files = {p.name: p for p in ROOT.glob("*.png")}
    # Prefer known names by size signature
    by_size = {}
    for p in files.values():
        im = Image.open(p)
        by_size[(im.width, im.height)] = p

    icon_src = by_size.get((1536, 1024)) or list(files.values())[0]
    landscape = by_size.get((1586, 992))
    mobiles = [p for p in files.values() if Image.open(p).height > Image.open(p).width]

    assets_dir = OUT / "store-assets"
    assets_dir.mkdir(exist_ok=True)

    icon = fit_cover(Image.open(icon_src), 1024, 1024)
    icon_path = assets_dir / "icon-1024.png"
    icon.save(icon_path, format="PNG", optimize=True)

    if landscape:
        banner = fit_cover(Image.open(landscape), 1920, 1080)
    else:
        banner = fit_contain_pad(Image.open(icon_src), 1920, 1080)
    banner_path = assets_dir / "banner-1920x1080.png"
    banner.save(banner_path, format="PNG", optimize=True)

    square = fit_cover(Image.open(icon_src), 1440, 1440)
    square_path = assets_dir / "square-1440.png"
    square.save(square_path, format="PNG", optimize=True)

    shot_paths = []
    for i, p in enumerate(mobiles[:5]):
        im = Image.open(p).convert("RGB")
        # keep portrait; ensure min side decent
        outp = assets_dir / f"shot-{i + 1}.png"
        im.save(outp, format="PNG", optimize=True)
        shot_paths.append(outp)

    return {
        "icon": icon_path,
        "banner": banner_path,
        "square": square_path,
        "shots": shot_paths,
        "sources": {"icon": str(icon_src), "landscape": str(landscape), "mobiles": [str(x) for x in mobiles]},
    }


DESCRIPTION = (
    "你是一所职业技术学院的校长。十四年任期，一年四季，一季一件事。\n\n"
    "带队伍、盖楼、盯账本，也要处理部门来信和学生舆论。升本可以走普通本科，"
    "继续冲 212、986、D9；也可以走职业本科，专攻专业硕士点和整合。\n\n"
    "把柄、评审、巡察会跟着决策回来。校园在转，你的选择会写进这所学校的档案。"
)

DEVELOPER_MESSAGE = (
    "《大学校长模拟器》是一款日系治愈风校园经营游戏。\n"
    "我们想做的不是纯堆数值，而是让你在校长办公室里感到学校真的在运转："
    "学科建设、基建、引进、申报，每件事都有起因和后续。\n"
    "欢迎试玩反馈。真夜工作室。"
)

PROMOTION_TEXT = "十四年任期，经营一所大学"


def save_changes(changes: list, key: str, dry: bool = False) -> dict:
    p = OUT / f"save-{key}.json"
    write_json(p, {"changes": changes})
    args = [
        "app",
        "save-changes",
        "--dev-id",
        DEV,
        "--app-id",
        APP,
        "--data",
        f"@{p.as_posix()}",
        "--idempotency-key",
        key,
    ]
    args.append("--dry-run" if dry else "--yes")
    return run_cli(args)


def main() -> int:
    print("prepare assets...")
    paths = prepare_assets()
    write_json(OUT / "prepared-assets.json", {k: (str(v) if not isinstance(v, list) else [str(x) for x in v]) for k, v in paths.items() if k != "sources"})
    print("sources", paths["sources"])

    print("upload images...")
    icon_val = upload_image(paths["icon"], "store-icon-1024-20261117")
    banner_val = upload_image(paths["banner"], "store-banner-1920-20261117")
    square_val = upload_image(paths["square"], "store-square-1440-20261117")
    shot_vals = []
    for i, sp in enumerate(paths["shots"]):
        shot_vals.append(upload_image(sp, f"store-shot-{i + 1}-20261117"))

    write_json(
        OUT / "uploaded-assets.json",
        {"icon": icon_val, "banner": banner_val, "square": square_val, "shots": shot_vals},
    )

    # re-read modules for expected
    basic = get_module("basic-info")
    assets = get_module("assets-upload")
    promo = get_module("profile-promotion")
    dev = get_module("developer-info")
    plat = get_module("platform-status")

    def cv(mod, fid):
        return mod["fields"][fid].get("current_value")

    # Batch 1: text + promotion type
    changes1 = [
        {"field_id": "description", "value": DESCRIPTION, "expected": cv(basic, "description")},
        {"field_id": "developer_message", "value": DEVELOPER_MESSAGE, "expected": cv(dev, "developer_message")},
        {"field_id": "promotion_text", "value": PROMOTION_TEXT, "expected": cv(promo, "promotion_text")},
        {"field_id": "promotion_material_type", "value": "BANNER_4", "expected": cv(promo, "promotion_material_type")},
        {"field_id": "author_name", "value": "真夜工作室", "expected": cv(dev, "author_name")},
        {"field_id": "developer_type", "value": "developer", "expected": cv(dev, "developer_type")},
        {"field_id": "publisher_name", "value": "真夜工作室", "expected": cv(dev, "publisher_name")},
    ]
    print("save text dry...")
    print(json.dumps(save_changes(changes1, "store-text-20261117a", dry=True), ensure_ascii=False)[:600])
    print("save text yes...")
    print(json.dumps(save_changes(changes1, "store-text-20261117a", dry=False), ensure_ascii=False)[:800])

    # re-read after text for image expecteds
    basic = get_module("basic-info")
    assets = get_module("assets-upload")

    changes2 = [
        {"field_id": "icon", "value": icon_val, "expected": cv(basic, "icon")},
        {"field_id": "banner_4", "value": banner_val, "expected": cv(assets, "banner_4")},
        {"field_id": "square_promo_image", "value": square_val, "expected": cv(assets, "square_promo_image")},
        {
            "field_id": "screenshots",
            "op": "replace",
            "value": shot_vals,
            "expected": cv(assets, "screenshots"),
        },
    ]
    print("save images dry...")
    print(json.dumps(save_changes(changes2, "store-images-20261117a", dry=True), ensure_ascii=False)[:600])
    print("save images yes...")
    print(json.dumps(save_changes(changes2, "store-images-20261117a", dry=False), ensure_ascii=False)[:1000])

    # platform: set MOBILE if empty; set android region if options allow play
    plat = get_module("platform-status")
    pf = plat["fields"]
    print("platform fields:")
    for fid, f in pf.items():
        print(
            fid,
            "cv=",
            f.get("current_value"),
            "labels=",
            f.get("value_labels"),
            "options=",
            f.get("options"),
            "state=",
            f.get("state"),
        )

    changes3 = []
    if cv(plat, "app_platforms") in (None, [], ""):
        changes3.append(
            {
                "field_id": "app_platforms",
                "value": ["MOBILE"],
                "expected": cv(plat, "app_platforms"),
            }
        )
    # Prefer open play if option 4 exists, else leave for user
    android = pf.get("region_flag_android") or {}
    if android.get("options") and "4" in android.get("options", []) and android.get("current_value") != "4":
        changes3.append(
            {
                "field_id": "region_flag_android",
                "value": "4",
                "expected": android.get("current_value"),
            }
        )
    if changes3:
        print("save platform...")
        # platforms first alone if region depends on it
        if len(changes3) > 1 and changes3[0]["field_id"] == "app_platforms":
            print(json.dumps(save_changes([changes3[0]], "store-plat-mobile-20261117", dry=False), ensure_ascii=False)[:500])
            plat = get_module("platform-status")
            android = plat["fields"].get("region_flag_android") or {}
            if android.get("options") and "4" in android.get("options", []):
                ch = [
                    {
                        "field_id": "region_flag_android",
                        "value": "4",
                        "expected": android.get("current_value"),
                    }
                ]
                print(json.dumps(save_changes(ch, "store-plat-android4-20261117", dry=False), ensure_ascii=False)[:500])
        else:
            print(json.dumps(save_changes(changes3, "store-plat-20261117", dry=False), ensure_ascii=False)[:800])

    status = run_cli(["app", "analyze-status", "--dev-id", DEV, "--app-id", APP])
    write_json(OUT / "analyze-after-fill.json", status)
    print("STATUS", json.dumps(status.get("data", {}).get("result", {}), ensure_ascii=False, indent=2)[:2000])
    return 0


if __name__ == "__main__":
    sys.exit(main())
