# -*- coding: utf-8 -*-
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
        print("CLI_RAW", text[:1500])
        raise


def write_json(path: Path, obj) -> None:
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def assessment_snapshot() -> str:
    d = run_cli(["qualification", "get-assessment", "--dev-id", DEV, "--app-id", APP])
    write_json(OUT / "get-assessment2.json", d)
    return d["data"]["result"]["snapshot"]


def make_video() -> Path:
    import imageio.v2 as imageio

    shots = sorted((OUT / "store-assets").glob("shot-*.png"))
    target = (720, 1280)  # even, portrait
    frames = []
    for p in shots:
        im = Image.open(p).convert("RGB")
        # cover crop to 9:16
        scale = max(target[0] / im.width, target[1] / im.height)
        nw, nh = int(im.width * scale + 0.5), int(im.height * scale + 0.5)
        im = im.resize((nw, nh), Image.Resampling.LANCZOS)
        left = (nw - target[0]) // 2
        top = (nh - target[1]) // 2
        im = im.crop((left, top, left + target[0], top + target[1]))
        import numpy as np

        frames.append(np.asarray(im))

    out = OUT / "store-assets" / "gameplay-demo.mp4"
    if out.exists():
        out.unlink()
    writer = imageio.get_writer(
        out.as_posix(),
        fps=2,
        codec="libx264",
        quality=7,
        pixelformat="yuv420p",
        macro_block_size=1,
    )
    # >= 16 seconds
    for fr in frames:
        for _ in range(8):  # 4s each
            writer.append_data(fr)
    for fr in frames[:2]:
        for _ in range(4):
            writer.append_data(fr)
    writer.close()
    print("video ready", out, out.stat().st_size)
    return out


def main() -> int:
    snap = assessment_snapshot()
    print("snapshot", snap[:16], "...")

    # 1) age grade 12
    age = {
        "app_id": int(APP),
        "developer_id": int(DEV),
        "age_grade": 12,
        "expected_snapshot": snap,
    }
    write_json(OUT / "save-age.json", age)
    print("age dry", json.dumps(run_cli([
        "qualification", "save-age-grade", "--dev-id", DEV, "--app-id", APP,
        "--data", "@release/save-age.json", "--idempotency-key", "age-12-20261117", "--dry-run"
    ]), ensure_ascii=False)[:400])
    print("age yes", json.dumps(run_cli([
        "qualification", "save-age-grade", "--dev-id", DEV, "--app-id", APP,
        "--data", "@release/save-age.json", "--idempotency-key", "age-12-20261117", "--yes"
    ]), ensure_ascii=False)[:800])

    # refresh snapshot after age save
    snap = assessment_snapshot()

    # 2) app feature facts + empty qualification materials where possible
    draft = {
        "app_id": int(APP),
        "developer_id": int(DEV),
        "expected_snapshot": snap,
        "app_features": {
            "is_internet_required": True,  # TapTap online load
            "has_in_app_purchase": False,
            "has_text_story_simulation": True,
            "has_ai_content": False,
            "has_ip_authorization": False,
        },
        # no AI service; declare for H5
        "qualification": {
            "qualification_type": "ai-declaration",
            "aigc_qualification": {
                "provide_aigc_service": False,
                "package_types": ["h5"],
            },
        },
    }
    write_json(OUT / "save-qual-draft.json", draft)
    print("qual draft", json.dumps(run_cli([
        "qualification", "save-draft", "--dev-id", DEV, "--app-id", APP,
        "--data", "@release/save-qual-draft.json", "--idempotency-key", "qual-facts-20261117", "--yes"
    ]), ensure_ascii=False)[:1200])

    # 3) gameplay video
    video = make_video()
    up = run_cli([
        "upload-video", str(video.as_posix()),
        "--dev-id", DEV, "--app-id", APP,
        "--scene", "gameplay_demo_video",
        "--idempotency-key", "store-gameplay-demo-20261117b",
        "--yes",
    ])
    write_json(OUT / "upload-video-result.json", up)
    print("upload video keys", up.get("data", {}).keys() if isinstance(up.get("data"), dict) else up)
    print(json.dumps(up, ensure_ascii=False)[:1000])
    data = up.get("data") or {}
    video_id = data.get("videoId") or data.get("video_id")
    if video_id is None and isinstance(data.get("result"), dict):
        video_id = data["result"].get("videoId") or data["result"].get("video_id")
    if video_id is None:
        print("NO_VIDEO_ID")
        return 1

    write_json(OUT / "mod-assets-upload.json", {"module_id": "assets-upload"})
    assets = run_cli([
        "app", "get-module", "--dev-id", DEV, "--app-id", APP,
        "--data", "@release/mod-assets-upload.json",
    ])["data"]["result"]
    expected = assets["fields"]["gameplay_demo_video"].get("current_value")
    write_json(OUT / "save-video.json", {
        "changes": [{
            "field_id": "gameplay_demo_video",
            "value": video_id,
            "expected": expected,
        }]
    })
    print("save video", json.dumps(run_cli([
        "app", "save-changes", "--dev-id", DEV, "--app-id", APP,
        "--data", "@release/save-video.json",
        "--idempotency-key", "store-save-gameplay-20261117b", "--yes"
    ]), ensure_ascii=False)[:800])

    # also set iOS distribute to provide play if option 0 means 提供下载
    write_json(OUT / "mod-platform-status.json", {"module_id": "platform-status"})
    plat = run_cli([
        "app", "get-module", "--dev-id", DEV, "--app-id", APP,
        "--data", "@release/mod-platform-status.json",
    ])["data"]["result"]
    ios = plat["fields"].get("region_flag_ios") or {}
    print("ios", ios.get("current_value"), ios.get("value_labels"), ios.get("options"))
    if ios.get("options") and "0" in ios.get("options", []) and ios.get("current_value") != "0":
        write_json(OUT / "save-ios.json", {"changes": [{
            "field_id": "region_flag_ios",
            "value": "0",
            "expected": ios.get("current_value"),
        }]})
        print("save ios", json.dumps(run_cli([
            "app", "save-changes", "--dev-id", DEV, "--app-id", APP,
            "--data", "@release/save-ios.json",
            "--idempotency-key", "store-ios-play-20261117", "--yes"
        ]), ensure_ascii=False)[:500])

    final = run_cli(["app", "analyze-status", "--dev-id", DEV, "--app-id", APP])
    write_json(OUT / "analyze-final2.json", final)
    print("FINAL", json.dumps(final.get("data", {}).get("result", {}), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
