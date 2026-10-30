/** 已确认的双向入口与切入机位；本机修改优先于此默认配置。 */
export const DEFAULT_TOUR = {
  "version": 1,
  "propertyId": "ai-demo",
  "routes": {
    "living": [
      {
        "target": "dining",
        "label": "",
        "style": "ring",
        "color": "#ffffff",
        "size": 42,
        "entryFov": 95,
        "yaw": 171.2,
        "pitch": -13.7,
        "entryYaw": 89.7,
        "entryPitch": -21.4
      }
    ],
    "dining": [
      {
        "target": "living",
        "label": "",
        "style": "ring",
        "color": "#ffffff",
        "size": 42,
        "entryFov": 95,
        "yaw": 202.5,
        "pitch": -19.2,
        "entryYaw": 72.4,
        "entryPitch": -5.1
      }
    ]
  },
  "annotations": {
    "living": [],
    "dining": []
  },
  "sceneViews": {
    "living": {
      "yaw": 93.2,
      "pitch": -35.4,
      "fov": 95
    },
    "dining": {
      "yaw": 88.4,
      "pitch": -20.8,
      "fov": 95
    }
  }
};
