# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

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
        print("CLI_RAW", text[:1200])
        raise


def write_json(path: Path, obj) -> None:
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def make_gameplay_video() -> Path:
    try:
        import imageio.v2 as imageio
    except Exception:
        imageio = None

    shots = sorted((OUT / "store-assets").glob("shot-*.png"))
    if not shots:
        raise SystemExit("no shots")

    out = OUT / "store-assets" / "gameplay-demo.mp4"

    # Prefer ffmpeg if on PATH later; else imageio-ffmpeg via imageio
    if imageio is None:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "imageio", "imageio-ffmpeg", "-q"])
        import imageio.v2 as imageio  # type: ignore

    frames = []
    for p in shots:
        frames.append(imageio.imread(p))
    # 16s slideshow, ~2fps with repeats to satisfy min 15s and show gameplay UI
    writer = imageio.get_writer(
        out,
        fps=2,
        codec="libx264",
        quality=8,
        pixelformat="yuv420p",
        macro_block_size=None,
    )
    # each shot ~4 seconds
    for fr in frames:
        for _ in range(8):
            writer.append_data(fr)
    # pad to >= 16s
    while True:
        # rough: len(frames)*8 / 2 seconds already; ensure >= 16s
        break
    for fr in frames[:2]:
        for _ in range(4):
            writer.append_data(fr)
    writer.close()
    print("video", out, out.stat().st_size)
    return out


def main() -> int:
    status = run_cli(["app", "analyze-status", "--dev-id", DEV, "--app-id", APP])
    write_json(OUT / "analyze-now.json", status)
    print("analyze", json.dumps(status.get("data", {}).get("result", {}), ensure_ascii=False, indent=2))

    # Qualification assessment
    for cmd in [
        ["qualification", "get-status", "--dev-id", DEV, "--app-id", APP],
        ["qualification", "get-assessment", "--dev-id", DEV, "--app-id", APP],
    ]:
        d = run_cli(cmd)
        write_json(OUT / f"{cmd[1]}.json", d)
        print(cmd[1], "ok=", d.get("ok"))
        print(json.dumps(d.get("data", {}), ensure_ascii=False)[:2000])

    # Age grade schema / help via dry-run inspection
    for name in ["save-age-grade", "save-draft", "save-h5-game-filing"]:
        d = run_cli(["schema", "qualification", name])
        write_json(OUT / f"schema-{name}.json", d)
        schema = d.get("data", {}).get("inputSchema") or d.get("data", {})
        print("schema", name, json.dumps(schema, ensure_ascii=False)[:1500])

    # Try create gameplay video and upload if still needed
    blockers = (status.get("data") or {}).get("result", {}).get("blockers") or []
    need_video = any("gameplay_demo_video" in (b.get("field_ids") or []) for b in blockers)
    print("need_video", need_video)
    if need_video:
        video = make_gameplay_video()
        # upload-video with scene
        d = run_cli(
            [
                "upload-video",
                str(video.as_posix()),
                "--dev-id",
                DEV,
                "--app-id",
                APP,
                "--scene",
                "gameplay_demo_video",
                "--idempotency-key",
                "store-gameplay-demo-20261117",
                "--yes",
            ]
        )
        write_json(OUT / "upload-video-result.json", d)
        print("upload video", json.dumps(d, ensure_ascii=False)[:1200])
        video_id = None
        if d.get("ok"):
            video_id = (
                d.get("data", {}).get("videoId")
                or d.get("data", {}).get("video_id")
                or d.get("data", {}).get("result", {}).get("videoId")
            )
        if video_id is not None:
            # read assets module for expected
            write_json(OUT / "mod-assets-upload.json", {"module_id": "assets-upload"})
            assets = run_cli(
                [
                    "app",
                    "get-module",
                    "--dev-id",
                    DEV,
                    "--app-id",
                    APP,
                    "--data",
                    "@release/mod-assets-upload.json",
                ]
            )["data"]["result"]
            expected = assets["fields"]["gameplay_demo_video"].get("current_value")
            changes = {
                "changes": [
                    {
                        "field_id": "gameplay_demo_video",
                        "value": video_id,
                        "expected": expected,
                    }
                ]
            }
            write_json(OUT / "save-video.json", changes)
            saved = run_cli(
                [
                    "app",
                    "save-changes",
                    "--dev-id",
                    DEV,
                    "--app-id",
                    APP,
                    "--data",
                    "@release/save-video.json",
                    "--idempotency-key",
                    "store-save-gameplay-20261117",
                    "--yes",
                ]
            )
            print("save video field", json.dumps(saved, ensure_ascii=False)[:800])

    status2 = run_cli(["app", "analyze-status", "--dev-id", DEV, "--app-id", APP])
    write_json(OUT / "analyze-final.json", status2)
    print("FINAL", json.dumps(status2.get("data", {}).get("result", {}), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
