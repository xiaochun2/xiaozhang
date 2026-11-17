# 图标素材

统一放在 `public/game-assets/assets/` 下，与 buildings / characters 同级。

## Campus soft-3D（全局 UI）

路径：`public/game-assets/assets/icons/campus/`

来源：`日式治愈系校园图标风格指南.png` 切片。圆润 soft-3D / clay 风格。

运行时由 `src/ui/campus-icons.js` 渲染为 `<img class="campus-ico">`，经 `game.js` 的 `icon()` 统一调用。

| 逻辑名 | 文件 | 用途 |
|---|---|---|
| `tasks` / `office` | `nav-tasks.png` | 办事 / 底部导航 |
| `school` / `build` | `nav-school.png` | 学校 |
| `teachers` / `recruit` | `nav-teachers.png` | 教师 |
| `apply` | `nav-apply.png` | 申报 |
| `home` / `overview` | `nav-overview.png` | 总览 / 首页 |
| `education` / `cap` | `education.png` | 学历帽 / 培养 |
| `search` | `search.png` | 招聘搜索 |
| `assess` | `assess.png` | 考核徽章 |
| `filter` | `filter.png` | 筛选 |
| `star` / `score` | `star.png` | 评分 |
| `coin` | `coin.png` | 经费 |
| `train` / `book` | `train.png` | 培养 / 书籍 |
| `back` | `more.png` | 返回 |
| `go` | `go.png` | 前进 / 右侧箭头 |

## 旧 Lucide 目录

`icons/lucide/` 与 `src/ui/lucide-icons.js` 已停用，保留仅作备份，新 UI 不要再引用。
