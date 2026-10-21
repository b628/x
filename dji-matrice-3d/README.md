# MATRICE / 04 — DJI 行业无人机三维图鉴

一个以 **Three.js 程序化建模** 构建的 DJI 行业无人机 3D 展示网站，覆盖：

- **Matrice 4T**：便携热成像 / 激光测距旗舰
- **Matrice 4E**：4/3 画幅高精度测绘平台
- **Matrice 4TD**：机场 3 配套的无人值守热成像机型
- **Matrice 5TD**：机场 4 配套的新一代换电旗舰

内容包含 **使用介绍、四机对比、机场 3 / 机场 4 配套方案、六大应用领域**。所有飞机、机场、任务地图与光效均由代码生成，不依赖外部 3D 模型文件。

![桌面端预览](./preview.png)

## 直接打开

网站已经打包完成，**不需要安装依赖**：

1. 双击 `index.html`，用 Chrome / Edge / Safari 打开即可。
2. 或在当前目录启动一个本地服务器：

```bash
python3 -m http.server 4173
# 打开 http://127.0.0.1:4173
```

建议使用桌面端 Chrome / Edge 获得完整的 WebGL 效果；移动端与平板已做响应式适配。

## 交互方式

| 操作 | 效果 |
| --- | --- |
| 滚动 | 场景在「机场 4 × 5TD → 四机阵容 → 单机细节 → 机场对比 → 任务地图」之间切换 |
| 拖拽空白处 / 3D 场景 | 环绕旋转当前模型 |
| 双击空白处 | 重置视角 |
| 点击顶部导航 | 跳转章节 |
| 点击阵容卡片 / 选型卡片 | 选中机型并进入三维细节 |
| 点击机型 Tab | 在 4T / 4E / 4TD / 5TD 之间切换，模型、参数与主题色同步变化 |
| 悬停结构标注 | 查看相机、RTK、感知系统说明 |
| 对比筛选 | 「便携系列 / 机场系列」高亮对应列 |
| 点击应用卡片 | 更新任务说明，并让 3D 任务地图聚焦对应信标 |
| 移动端菜单 | 右上角按钮打开章节导航 |

## 项目结构

```text
.
├── index.html              # 页面结构、中文内容
├── styles.css              # 视觉系统、响应式布局
├── assets/
│   ├── app.js              # 已打包的 Three.js 场景（esbuild IIFE）
│   └── fonts/              # 本地 Web 字体
├── src/
│   ├── main.js             # 场景编排、相机、滚动叙事、交互
│   └── models.js           # 程序化飞机 / 机场 / 任务地图建模
├── preview.png             # 桌面端预览
├── preview-mobile.png      # 移动端预览
├── package.json
└── README.md
```

## 重新构建

```bash
npm install
npm run build
```

开发时可使用：

```bash
npm run dev
```

## 内容与数据说明

- 页面为非官方产品展示，**三维模型为风格化示意，并非精确工程模型**。
- 参数与功能整理自 DJI 官方公开资料（截至 2026-10），实际规格、兼容性与作业表现以官方最新发布为准。
- Matrice 4T / 4E 为便携机型，**不进入机场自动机库**；机场 3 配套 Matrice 4D / 4TD，机场 4 配套 Matrice 5TD。
- 官方资料：
  - [DJI Matrice 4 系列](https://www.dji.com/cn/matrice-4-series)
  - [DJI 大疆机场 3](https://www.dji.com/cn/dock-3)
  - [DJI 大疆机场 4](https://www.dji.com/cn/dock-4)
  - [Matrice 4 系列技术参数](https://enterprise.dji.com/cn/matrice-4-series/specs)

## License

页面代码仅用于展示与学习。DJI、Matrice、DJI Dock 等名称与商标归大疆创新所有。
