# 天鹅绒桌游盒 · Velvet Tabletop

面向 **6–10 人线下聚会** 的商业级局域网多人桌游合集（Web / 手机扫码 / 电视投影大屏自适应）。开箱即用、100% 离线零外部 CDN 依赖，一台电脑或路由器局域网开机即可开桌，全员手机打开浏览器扫码秒连。

---

## 核心特性 / Key Features

- **双模式自适应大屏与纯手机开局**
  - **电视 / 投影大屏模式（`?mode=tv`）**：公共舞台渲染 4K 质感桌游场景、动态 Seedance 2.5 视频背景、公共开票/牌面/大富翁棋盘与语音法官播报，彻底解放真人主持。
  - **纯手机同桌模式**：无需外接大屏，房主与好友直接手机上桌同玩，内置 **3D 触控防偷窥暗牌（`PrivacyPeekCard`）**——按住翻牌、松手自动锁屏盖牌。
- **100% 离线局域网可用**：零 Google Fonts、零外部 JS/CSS CDN；全套游戏封面、14 张塔罗身份原画、12 套贵族头像、7 路 720p 循环舞台视频、74 条中英双语豆包配音与 3 首循环 BGM 全部本地打包在 `public/` 下。
- **防回声单设备智能语音路由**：当房间连接电视/投影大屏时自动由大屏端发声、玩家手机自动静音避免回声；无大屏时自动由房主手机负责语音播报（支持任意端手动覆写开关）。
- **断线无感重连与房主控场台（`HostControlDrawer`）**：
  - 通过本地 `playerToken` 与 `sessionStorage` 断线秒回原席位并自动恢复私密手牌/身份。
  - 房主随时暂停/恢复倒计时、跳过卡顿回合、增删 AI 机器人补位、为掉线好友切换 **AI 托管**、移交房主、零重扫换游戏，以及清零整晚 **派对累计积分榜**。
- **严格服务端反作弊**：`projectPublic()` 与 `projectPrivate()` 物理隔离——公共推送永不暴露卧底词、底牌、真实身份、夜里毒杀原因（狼人杀局中 `'poison'` 统一隐匿为 `'night'`，仅终局揭晓）。
- **完整中英双语（`简体中文` / `English`）**：实时同步全房语言、双语规则速览、双语语音法官。

---

## 内置六大经典聚会桌游 / 6-Game Roster

| 游戏 | 经典机制 | 人数 | 核心亮点 |
| :--- | :--- | :--- | :--- |
| **圆桌暗影：圣杯骑士**<br>*Crown & Chalice* | 阿瓦隆<br>*Avalon* | 5–10 人 | 梅林/派西维尔/莫甘娜/刺客/莫德雷德/奥伯伦；7人+ 第4任务需2失败 & 可选 **湖中仙女** 验人传盾；出征递进翻牌动画、即时投票席位徽章与本地推理标记 |
| **月蚀古堡：暗夜审判**<br>*Moonlit Coven* | 经典狼人杀<br>*Werewolf* | 6–10 人 | **全自动中英双语语音法官**；守卫→狼人→女巫→预言家标准夜序；死神职随机拟真伪延迟防听声计时；可选首日警长（1.5票）与 **警徽移交**；屠边胜负与古堡编年史 |
| **皇家德州：霓虹赌桌**<br>*Royal Hold'em* | 无限注德州<br>*No-Limit Hold'em* | 2–10 人 | 精确 7 选 5 评估（含 `A-2-3-4-5` 顺子与踢脚）；多人不等额 All-in 精准切分 **多级边池**；手机实时最佳牌型 + **最佳 5 张高亮**；摊牌 **Show Bluff 秀诈唬**、涨盲设置与净盈亏结算榜 |
| **星耀大亨：财阀帝国**<br>*Metropolis Tycoon* | 聚会大富翁<br>*Monopoly* | 2–10 人 | 28 格 8×8 都会棋盘；流拍立刻触发 **10 秒全员手机实时竞拍**；免税广场累积奖池；命运轮盘/财团金库双卡堆；全棋盘点击弹出 **地契详情卡** 与名下多地产 Lv.0–Lv.4 扩建 |
| **灵魂画手：传声晚宴**<br>*Sketch Relay* | 传声画猜<br>*Telestrations / Gartic Phone* | 4–10 人 | 全员同步出题/作画/猜词 **零等待冷场**；**94 条**双语脑洞题库支持一键换题；平滑二次贝塞尔画笔、撤销/重做、油漆桶、几何图形与超时 1.5s 自动交卷；大屏逐帧漫画画展 + **离线长图 PNG 一键导出** |
| **假面卧底：谍影晚宴**<br>*Masquerade Undercover* | 谁是卧底<br>*Undercover* | 4–10 人 | **167 组**无重复双语精选词对（6 大分类）+ 6人+ 白板机制；实时剩余潜伏者计数、有序发言队列、**按轮次分组且可按玩家筛选的线索墙**、平票 PK 加时赛与全员投票箭线回顾 |

---

## 快速开始 / Quick Start

### 环境要求
- Node.js `>= 20.0.0`
- `pnpm`（建议 `>= 9`）

### 本地开发与测试
```bash
pnpm install
pnpm dev
```
开发模式默认监听 `http://localhost:3210`（同时可在终端日志中查看当前局域网网卡 IP，如 `http://192.168.x.x:3210`，方便同一 Wi-Fi 手机直接扫码加入）。

### 生产构建与部署
```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
PORT=3210 pnpm start
```
> 提示：macOS 的隔空播放接收器（AirPlay Receiver）默认占用 `5000` 与 `7000` 端口，因此本项目默认使用 `3210` 端口。

### 多标签页本地单机联调技巧
同一台电脑打开多个浏览器标签页即可独立模拟多台手机身份（独立 `playerToken` 互不覆盖）：
- 电视 / 投影大屏端：`http://localhost:3210/?mode=tv`
- 房主手机端：`http://localhost:3210/`
- 玩家 2~N：`http://localhost:3210/?client=p2`、`http://localhost:3210/?client=p3` ...

### Docker 部署
```bash
docker build -t velvet-tabletop .
docker run -d -p 3210:3210 --name velvet-tabletop velvet-tabletop
```

---

## 可选环境变量与 AI 媒体生成脚本

所有开箱即玩所需音画资产均已内置于 `public/` 目录，**无需配置任何 API Key 即可直接完整运行游戏**。

如需开启“灵魂画手画展阶段现场动态 TTS 读字”或重新生成媒体资源，可复制 `.env.example` 为 `.env.local` 并填入密钥：
```bash
cp .env.example .env.local
```
- `DOUBAO_API_KEY`：火山引擎豆包语音单 Key（用于 `pnpm gen:audio` 及 `/api/tts` 实时语音合成，未配置时前端自动退化至浏览器原生 `speechSynthesis`）。
- `ARK_API_KEY`：火山方舟 Seedream 5.5 / Seedance 2.5 密钥（用于 `pnpm gen:flagship-art`、`pnpm gen:flagship-videos` 幂等生成头像、角色牌与舞台循环背景视频）。

---

## 工程目录结构 / Architecture

```text
├── public/                     # 本地打包的离线零 CDN 音画资源
│   ├── audio/                  # 74 条中英配音 MP3 + 3 首循环 BGM
│   ├── images/                 # 品牌徽章、游戏封面、14 张角色塔罗牌、12 个贵族头像
│   └── videos/                 # 7 路 720p H.264 +faststart 大屏舞台循环背景视频
├── scripts/                    # 幂等化 Doubao TTS / Seedream / Seedance 资源生成脚本
├── src/
│   ├── shared/                 # 前后端共享目录、扑克牌型评估器、分游戏契约类型 (src/shared/types/)
│   ├── server/                 # Express + Socket.IO 房管内核、局域网网卡识别、6 大游戏状态机、词库题库
│   └── client/                 # React 19 + Tailwind v4 UI、Audio/Haptic 引擎、画板工作室、双语 i18n
├── tests/                      # Vitest 单元测试与真实 Socket.IO 局域网联调集成测试
├── Dockerfile                  # 多阶段生产容器镜像构建
└── .github/workflows/ci.yml    # GitHub Actions 自动化 typecheck / test / build
```
