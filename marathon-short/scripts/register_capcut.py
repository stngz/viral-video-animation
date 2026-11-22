"""
register_capcut.py — Optionally register the final rendered Marathon 1904 animated MP4
into CapCut Desktop as a ready-to-open project (in case the user wants Auto Captions or final export tweaks).
"""
import json
import os
import shutil
import subprocess
import time
import uuid

VIDEO_PATH = r"c:\Users\NATHANIEL\Videos\Video Animation\marathon-short\out\the_1904_olympic_marathon.mp4"
CAPCUT_ROOT = r"C:\Users\NATHANIEL\AppData\Local\CapCut\User Data\Projects\com.lveditor.draft"
DRAFT_NAME = "The 1904 Olympic Marathon"
DURATION_US = 99_000_000  # 99.000 s in microseconds


def main():
    if not os.path.exists(CAPCUT_ROOT):
        print("CapCut draft folder not found, skipping.")
        return
    if not os.path.exists(VIDEO_PATH):
        print("Final video not found yet:", VIDEO_PATH)
        return

    draft_dir = os.path.join(CAPCUT_ROOT, DRAFT_NAME)
    os.makedirs(draft_dir, exist_ok=True)

    cover_dst = os.path.join(draft_dir, "draft_cover.jpg")
    subprocess.run(
        ["ffmpeg", "-y", "-ss", "68.5", "-i", VIDEO_PATH, "-vframes", "1", "-q:v", "2", cover_dst],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )

    vid_id = str(uuid.uuid4()).upper()
    seg_id = str(uuid.uuid4()).upper()
    track_id = str(uuid.uuid4()).upper()
    draft_id = str(uuid.uuid4()).upper()
    now_us = int(time.time() * 1_000_000)

    draft_content = {
        "canvas_config": {"height": 1920, "ratio": "9:16", "width": 1080},
        "color_space": 0,
        "duration": DURATION_US,
        "fps": 30.0,
        "id": draft_id,
        "materials": {
            "videos": [
                {
                    "aigc_type": "none",
                    "audio_fade": None,
                    "category_name": "local",
                    "crop": {
                        "lower_left_x": 0.0, "lower_left_y": 1.0,
                        "lower_right_x": 1.0, "lower_right_y": 1.0,
                        "upper_left_x": 0.0, "upper_left_y": 0.0,
                        "upper_right_x": 1.0, "upper_right_y": 0.0,
                    },
                    "duration": DURATION_US,
                    "has_audio": True,
                    "height": 1920,
                    "id": vid_id,
                    "local_material_id": vid_id,
                    "material_name": os.path.basename(VIDEO_PATH),
                    "path": VIDEO_PATH,
                    "type": "video",
                    "width": 1080,
                }
            ]
        },
        "name": DRAFT_NAME,
        "new_version": "110.0.0",
        "tracks": [
            {
                "attribute": 0,
                "flag": 0,
                "id": track_id,
                "segments": [
                    {
                        "enable_adjust": True,
                        "enable_color_curves": True,
                        "enable_color_match_adjust": False,
                        "enable_color_wheels": True,
                        "enable_lut": True,
                        "enable_smart_color_adjust": False,
                        "id": seg_id,
                        "material_id": vid_id,
                        "source_timerange": {"duration": DURATION_US, "start": 0},
                        "speed": 1.0,
                        "target_timerange": {"duration": DURATION_US, "start": 0},
                        "track_attribute": 0,
                        "track_render_index": 0,
                        "visible": True,
                        "volume": 1.0,
                    }
                ],
                "type": "video",
            }
        ],
        "version": 360000,
    }

    with open(os.path.join(draft_dir, "draft_content.json"), "w", encoding="utf-8") as f:
        json.dump(draft_content, f, indent=2)

    meta = {
        "draft_fold_path": draft_dir.replace("\\", "/"),
        "draft_id": draft_id,
        "draft_name": DRAFT_NAME,
        "draft_root_path": CAPCUT_ROOT.replace("\\", "/"),
        "tm_draft_create": now_us,
        "tm_draft_modified": now_us,
        "tm_duration": DURATION_US,
    }
    with open(os.path.join(draft_dir, "draft_meta_info.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    root_meta_path = os.path.join(CAPCUT_ROOT, "root_meta_info.json")
    if os.path.exists(root_meta_path):
        with open(root_meta_path, "r", encoding="utf-8") as f:
            root_meta = json.load(f)
        entries = root_meta.get("all_draft_store", [])
        entries = [e for e in entries if e.get("draft_name") != DRAFT_NAME]
        entries.insert(0, {
            "draft_cloud_capcut_purchase_info": "",
            "draft_cloud_last_action_download": False,
            "draft_cloud_materials": [],
            "draft_cloud_purchase_info": "",
            "draft_cloud_template_id": "",
            "draft_cloud_tutorial_info": "",
            "draft_cloud_videocut_purchase_info": "",
            "draft_cover": cover_dst.replace("\\", "/"),
            "draft_fold_path": draft_dir.replace("\\", "/"),
            "draft_id": draft_id,
            "draft_is_ai_shorts": False,
            "draft_is_invisible": False,
            "draft_json_file": os.path.join(draft_dir, "draft_content.json").replace("\\", "/"),
            "draft_name": DRAFT_NAME,
            "draft_new_version": "",
            "draft_root_path": CAPCUT_ROOT.replace("\\", "/"),
            "draft_timeline_materials_size": os.path.getsize(VIDEO_PATH),
            "draft_type": "",
            "tm_draft_cloud_completed": "",
            "tm_draft_cloud_modified": 0,
            "tm_draft_create": now_us,
            "tm_draft_modified": now_us,
            "tm_duration": DURATION_US,
        })
        root_meta["all_draft_store"] = entries
        with open(root_meta_path, "w", encoding="utf-8") as f:
            json.dump(root_meta, f, indent=2)
    print("Registered CapCut Desktop project:", draft_dir)


if __name__ == "__main__":
    main()
