"""Calibration tool — draw ROI polygons and save shelf baseline.

Usage:
    python edge/calibrate.py --camera 0

Steps:
    1. A live camera frame is shown.
    2. Click to draw the zone ROI polygon (footfall zone). Press ENTER to confirm.
    3. Click to draw the shelf ROI polygon. Press ENTER to confirm.
    4. The current frame is saved as shelf_baseline.jpg.
    5. config/zones.json is written with polygon coordinates.
"""
import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).parent.parent
CONFIG_PATH = ROOT / 'config' / 'zones.json'
BASELINE_PATH = ROOT / 'config' / 'shelf_baseline.jpg'

# Load existing config for default thresholds
def load_or_default():
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            return json.load(f)
    return {"surge_threshold": 4, "low_stock_threshold": 20,
            "sample_interval_seconds": 5, "reorder_base_qty": 50,
            "api_url": "http://localhost:8080", "device_id": "edge-node-01"}


points = []
current_frame = None

def mouse_callback(event, x, y, flags, param):
    global points
    if event == cv2.EVENT_LBUTTONDOWN:
        points.append([x, y])

def draw_polygon(frame, pts, color):
    preview = frame.copy()
    for pt in pts:
        cv2.circle(preview, tuple(pt), 5, color, -1)
    if len(pts) >= 2:
        cv2.polylines(preview, [np.array(pts, np.int32).reshape((-1, 1, 2))], False, color, 2)
    return preview


def collect_roi(cap, window_name: str, color: tuple, instructions: str):
    global points, current_frame
    points = []
    print(instructions)
    print("  Left-click to add points. Press ENTER to confirm. Press 'r' to reset.")

    while True:
        ret, frame = cap.read()
        if not ret:
            continue
        current_frame = frame.copy()
        preview = draw_polygon(frame, points, color)
        cv2.imshow(window_name, preview)
        key = cv2.waitKey(1) & 0xFF
        if key == 13 and len(points) >= 3:  # ENTER
            print(f"  ROI confirmed: {points}")
            return points[:]
        elif key == ord('r'):
            points = []
            print("  Reset. Click to start over.")


def main():
    parser = argparse.ArgumentParser(description='Singularity ROI Calibration')
    parser.add_argument('--camera', type=int, default=0)
    args = parser.parse_args()

    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        print(f"Cannot open camera {args.camera}")
        sys.exit(1)

    window = 'Singularity Calibration'
    cv2.namedWindow(window)
    cv2.setMouseCallback(window, mouse_callback)

    print("\n=== STEP 1: Draw ZONE ROI (footfall zone) ===")
    zone_roi = collect_roi(cap, window, (0, 255, 0),
                           "Draw the footfall monitoring zone:")

    print("\n=== STEP 2: Draw SHELF ROI ===")
    shelf_roi = collect_roi(cap, window, (255, 165, 0),
                            "Draw the shelf area:")

    # Capture baseline frame
    ret, baseline = cap.read()
    cap.release()
    cv2.destroyAllWindows()

    cfg = load_or_default()
    cfg['zone_roi'] = zone_roi
    cfg['shelf_roi'] = shelf_roi

    CONFIG_PATH.parent.mkdir(exist_ok=True)
    with open(CONFIG_PATH, 'w') as f:
        json.dump(cfg, f, indent=2)
    print(f"\nSaved zones to {CONFIG_PATH}")

    if ret:
        cv2.imwrite(str(BASELINE_PATH), baseline)
        print(f"Saved shelf baseline to {BASELINE_PATH}")
    else:
        print("WARNING: Could not capture baseline frame.")

    print("\nCalibration complete. Run: python edge/main.py --camera", args.camera)


if __name__ == '__main__':
    main()
