# softie · 软乎乎。

<p align="center">
  <img src="docs/images/promo-poster.png" alt="softie · 软乎乎" width="520" />
</p>

[![License: MIT](https://img.shields.io/github/license/yuanyang749/softie-webgpu)](LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-softie.520ai.site-4c6ef5)](https://softie.520ai.site)
[![WebGPU](https://img.shields.io/badge/WebGPU-native-22863a)](https://www.w3.org/TR/webgpu/)
[![Three.js](https://img.shields.io/badge/three.js-0.185-black)](https://threejs.org)
[![GitHub stars](https://img.shields.io/github/stars/yuanyang749/softie-webgpu?style=social)](https://github.com/yuanyang749/softie-webgpu/stargazers)

一个基于原生 WebGPU 的治愈系 3D 软体减压小玩具与休闲消除游戏。

在线体验：[https://softie.520ai.site](https://softie.520ai.site)

---

## 核心功能

### 1. 软乎乎史莱姆（解压桌面玩具）

- **自由揉捏交互**：按住局部凹陷、拖动拎起拉伸、松手回弹；支持移动端双指捏合拉伸（Pinch-to-stretch）以及点击/空格「戳一下」。
- **打工趣味装扮**：支持自由佩戴打工人工牌、续命冰美式咖啡、战损创可贴等趣味装扮，配件随软体表面实时动态形变。
- **打工怨气槽 HUD**：磨砂玻璃风格的状态指示，实时反映打工情绪（摸鱼放空、有点暴躁、惊醒等），随揉捏戳戳动态化解。
- **外观与手感定制**：预设草莓、薄荷、葡萄三种经典果冻色，支持自定义取色器；软硬度（糯叽叽 / 有弹性）与阻尼（晃悠悠 / 很乖巧）自由调节。
- **灵动表情与视线**：眼睛随鼠标和视线自然跟随，拥有眯眼、微笑、惊讶等多种动态情绪表情和自然眨眼。
- **音效与触感**：内置清脆解压音效，支持全局音量无级调节与一键静音。

### 2. 「消消气」3D 果冻消除小游戏

点击右上角或控制台的游戏手柄图标，即可进入全新推出的独立消除游戏（`/games/calm-match`）：

- **3D 果冻棋盘**：通透 Q 弹的 3D 果冻方块，支持点击与滑动交换消除，伴随绚丽的彩色炸裂粒子特效与连击反馈。
- **3D 陪伴角色**：呆萌史莱姆在棋盘旁实时陪伴，根据消除表现做出丰富的情绪表情与趣味气泡吐槽。
- **消气值系统**：消除果冻释放打工怨气，积攒消气值进度条触发满气解压效果。
- **解压实用道具**：提供一键重排、行列消除等减压小道具，搭配轻快弹簧动画。
- **触觉与声效反馈**：完整的消除音效组合，移动端支持触觉震动反馈。

### 3. 多端适配与国际化

- **双端响应式设计**：专为桌面端与移动端优化布局，触控区域舒适友好，无多余页面滚动。
- **中英双语支持**：右上角一键无缝切换中 / 英文，状态实时记忆，切换无需重新加载。

---

## 📱 iOS Safari 开启 WebGPU 指引

目前 iOS 系统的 WebGPU 处于实验性阶段（内置于 WebKit），在 iPhone / iPad Safari 浏览器中体验前需手动开启开关：

1. 打开系统 **「设置 (Settings)」** ➔ 往下滑动找到并进入 **「Safari 浏览器」**；
2. 滑动到最底部，点击进入 **「高级 (Advanced)」** ➔ 点击 **「WebKit 功能开关 (Feature Flags)」**；
3. 在列表中找到 **`WebGPU`** 以及 **`WebGPU support for HDR`**，将开关切换为**开启（绿色）**；
4. 返回 Safari 重新刷新网页，即可在手机端享受丝滑的 3D 软体捏捏乐与果冻消消气！

<p align="center">
  <img src="docs/images/ios-safari-webgpu.jpg" alt="iOS Safari 开启 WebGPU 指引" width="340" />
</p>

---

## 快速运行

```sh
npm install
npm run dev
```

本地打开 `http://127.0.0.1:5173`。

生产构建与预览：

```sh
npm run build
npm run preview
```

预览地址 `http://127.0.0.1:4173`。`dist` 目录可直接作为静态站点部署（线上环境需要 HTTPS 启用 WebGPU 支持）。

## 测试与验证

```sh
npm test                  # 运行单元测试
npm run test:browser      # 运行浏览器自动化测试
```

## License

Released under the [MIT License](LICENSE).
