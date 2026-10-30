# AI 住宅全景素材

- 日期：2026-10-13
- 方式：内置 image_gen，全新生成，未使用原住宅照片作为参考。
- 文件：`public/panoramas/ai-living-room.png`
- 实际尺寸：1774 × 887（2:1）。提示词中的 4096 × 2048 为期望尺寸，实际输出未达到该分辨率。
- 用途：住宅全景浏览、人物空间推演背景。

## 生成提示词

Use case: photorealistic-natural. Asset type: EasyVR interactive 360-degree interior panorama environment texture. Generate an entirely fictional modern residential living room, not based on any supplied photo. Output exactly 2:1 aspect ratio, ideally 4096x2048, full spherical equirectangular projection covering 360 degrees horizontally and 180 degrees vertically, seamless matching left and right edges, horizon at vertical center, zenith ceiling at top and nadir floor at bottom. Camera fixed at center of clear open living area at eye height 1.6m, level. Spacious calm modern apartment, warm off-white plaster walls, pale oak floor, floor-to-ceiling windows with soft daylight, minimal neutral sofa against perimeter wall, low cabinet and a few restrained indoor plants. Keep the central floor entirely open for placing virtual actors. Realistic architectural proportions and natural materials, coherent lighting, straight verticals in the equatorial region with appropriate spherical stretching toward poles. No people, no text, no watermarks, no branding, no UI, no borders. This must be a full equirectangular spherical environment map, not a normal wide angle perspective photograph or collage.

## AI 双点漫游素材

- 入口：`/?tour=ai-demo`。
- 客厅：`public/panoramas/ai-tour/living-room-pano-detail-v2.png`。
- 餐厅：`public/panoramas/ai-tour/dining-room-pano-draft.png`。
- 两张图片为已确认的 AI 全景，随项目本地提供。
- 默认往返热点、切入机位和房间默认视角：`src/tour/default-tour.js`。
- 交互视频与动图：`docs/demos/`，从 EasyVR 页面重新录制与制作。
