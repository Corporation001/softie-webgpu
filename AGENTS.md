# softie-webgpu

## 按任务定位
- Vite + 原生 JavaScript + Three.js；`npm run dev` 默认启动在 `http://127.0.0.1:5173`。
- 路由与首页切换：`src/app.js`；首页交互：`src/main.js`、`src/physics.js`、`src/slime.js`。
- 消消气 `/games/calm-match`：规则在 `src/games/calm-match/model.js`，界面在 `view.js` / `style.css`。
- 果冻渲染：同目录 `jelly-board.js` / `gel-material.js` / `jelly-shape.js`；陪伴角色在 `companion.js`。
- 游戏反馈在 `feedback.js`，共用音效总线在 `src/sound.js`。只读取当前改动相关的文件与技能。

## 项目约束
- 保留首页在路由切换前后的状态；新游戏使用独立的 `/games/<name>` 路径。
- 桌面与移动端共用规则；移动端棋盘和道具适配可用视口、无页面滚动，控制按钮触摸区至少 44px。
- 保持透明、Q 弹果冻材质；选中光效跟随本体变形，五官不投射到邻近果冻内部。
- 道具以独立透明小图展示，接入前裁切压缩；避免未经需要增加全屏渲染通道或重复创建 GPU 资源。

## 按改动范围验证
- 文档、技能说明或配置调整：检查语法、链接和命令；无需为此启动整套游戏回归。
- 游戏规则或音效逻辑：运行相关 `node --test tests/<name>.test.js`。
- 排版、图标、文字位置：`npm run test:game:layout`，并查看受影响尺寸的截图。
- 指针、键盘、菜单、道具、存档：`npm run test:game:flow`；加载或资源释放改动再加 `test:game:loading`。
- 渲染和动画改动：`npm run test:game:stress` 并查看效果；性能专项可运行 `CALM_CPU_RATE=4 CALM_PERF_CHECK=1 npm run test:game:stress`。
- 首页交互改动：相关单测与 `npm run test:browser`。
- 跨模块功能交付或发布前：`npm test`、`npm run build`、`npm run test:game`；首页受影响时再加首页回归。
- 浏览器测试需要本地服务，可用 `TEST_URL` 覆盖地址；截图和性能记录保存在 `artifacts/`。

## 完成与边界
- 本地测试使用可丢弃的测试数据、不接生产环境；直接运行并修复本次改动造成的失败，再复测受影响项。
- 实现、运行、检查结果并修复范围内问题后交付；小调整不必每一步重复完整回归，也不默认停在初稿。
- 说明实际验证的设备与范围；真机缺席时明确列出未验证项，不把模拟数据作为真机结论。
- 保留无关未提交改动；提交、推送、部署或更换付费服务按用户明确请求执行。
