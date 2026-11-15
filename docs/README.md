# 校园经营游戏素材库

## 当前交付
- `public/game-assets/assets/buildings/`：16 张独立透明建筑 PNG
- `public/game-assets/assets/characters/`：12 张独立透明人物 PNG
- 其余 `icons/ui/props/map/decorations/effects/badges/reference_atlases` 为图集或参考图，不作为单体控件拉伸
- `docs/asset-manifest.json`：素材清单
- `docs/cursor-prompt.md`：接入提示词
- `assets.js`：前端资源注册表（`GameAssets`）

## 页面引用
| 页面 | 引用 |
|---|---|
| 开局 / 结算 | `principal-male` |
| 办事首页 | `campus-gate` |
| 学校页头 / 侧栏 | `academic`；校园卡片按已建楼映射建筑 PNG |
| 教师列表 | 按职级从人物池映射立绘 |
| 申报页头 | `library` |

## 使用注意
独立 PNG 用 `object-fit: contain` 接入。图集只作参考。按钮文字、数值、进度条由前端绘制。
