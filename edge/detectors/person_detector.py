"""Person detector with YOLOv8n primary and OpenCV HOG fallback."""
import numpy as np
import cv2
from typing import List, Tuple

try:
    from ultralytics import YOLO
    _YOLO_AVAILABLE = True
except ImportError:
    _YOLO_AVAILABLE = False


class PersonDetector:
    """Detects persons in a frame and counts those within an ROI polygon."""

    def __init__(self):
        if _YOLO_AVAILABLE:
            self._model = YOLO('yolov8n.pt')  # downloads on first run
            self._backend = 'yolo'
        else:
            self._hog = cv2.HOGDescriptor()
            self._hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
            self._backend = 'hog'
            print(f"[PersonDetector] ultralytics not available, using HOG fallback")

    @property
    def backend(self) -> str:
        return self._backend

    def _point_in_polygon(self, point: Tuple[int, int], polygon: List[List[int]]) -> bool:
        poly = np.array(polygon, dtype=np.int32)
        return cv2.pointPolygonTest(poly, (float(point[0]), float(point[1])), False) >= 0

    def detect(self, frame: np.ndarray, roi_polygon: List[List[int]]) -> int:
        """Count persons whose centroid falls inside roi_polygon."""
        if self._backend == 'yolo':
            return self._detect_yolo(frame, roi_polygon)
        return self._detect_hog(frame, roi_polygon)

    def _detect_yolo(self, frame: np.ndarray, roi_polygon: List[List[int]]) -> int:
        results = self._model(frame, classes=[0], verbose=False)  # class 0 = person
        count = 0
        for result in results:
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                cx, cy = int((x1 + x2) / 2), int((y1 + y2) / 2)
                if self._point_in_polygon((cx, cy), roi_polygon):
                    count += 1
        return count

    def _detect_hog(self, frame: np.ndarray, roi_polygon: List[List[int]]) -> int:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        rects, _ = self._hog.detectMultiScale(
            gray, winStride=(8, 8), padding=(4, 4), scale=1.05
        )
        count = 0
        for (x, y, w, h) in rects:
            cx, cy = x + w // 2, y + h // 2
            if self._point_in_polygon((cx, cy), roi_polygon):
                count += 1
        return count
