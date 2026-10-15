# 爪印 · Pawprints Cat Modeling

可交互的三维猫咪示例工程，以及**独立于 App、交给用户自己的 Agent 执行的照片参考建模方法**。

当前源码为 **0.3.2 五官修整预览版**：包含薯片、羊羊、可探索的三维原野、两层互动小屋、走跑跳、相册、时间线和游记。猫咪外观仍有共享卡通底模的结构限制，没有达到照片级还原。

## 先看建模方法

| 你想做什么 | 入口 |
| --- | --- |
| 了解当前用了什么技术、怎样实现和有哪些限制 | **[当前建模技术与方法](modeling/METHOD.md)** |
| 把自己的猫咪照片交给 Agent 制作三维角色 | [通用工作流](modeling/WORKFLOW.md) · [可复制的 Agent 指令](modeling/AGENT-PROMPT.md) |
| 记录猫咪特征与基础资产适配信息 | [角色模板](modeling/templates/cat-profile.json) · [资产模板](modeling/templates/asset-adapter.json) |
| 检查长相、花色、毛发、动作与交付 | [验收清单](modeling/ACCEPTANCE.md) |
| 阅读版本修改过程 | [0.3.1 花色烘焙](modeling/COAT-REWORK-0.3.1.md) · [0.3.2 五官修整](modeling/FACE-REWORK-0.3.2.md) |

当前技术组合：**Three.js + 现成骨骼 GLB 改造 + 局部网格变形与 Phong 细分 + Python 照片 UV 烘焙 + 程序化几何毛发与五官 + GLSL 虹膜 + 蒙皮修复与程序化足端 IK。**

建模流程无需安装《爪印》。用户使用自己的 Agent、照片及建模工具制作角色，可以在独立查看器或其他项目展示。示例 App 没有接入照片自动建模服务。当前个性化外观在运行时生成，基础 GLB 不包含两只猫的完整定制毛发、五官和程序化动作。

## 下载桌面预览版

[下载 0.3.2 · macOS Apple Silicon · 预发布](https://github.com/2857577361/pawprints-cat-modeling/releases/tag/v0.3.2)

解压 `Pawprints-0.3.2-macOS-arm64.zip`，将 `Pawprints.app` 放入应用程序目录。当前是未做 Apple 公证的开发构建，仅提供 Apple Silicon Mac 安装包。校验值与下载说明见 [desktop/README.md](desktop/README.md)。旧版 [0.2.1](https://github.com/2857577361/pawprints-cat-modeling/releases/tag/v0.2.1) 保留。

## 本版更新

- **花色与五官**：两张 2048² 照片采样贴图；重新处理虹膜、鼻革、人中、唇线、眼睑、耳色与下巴。独立五官随头部骨架运动。
- **两层小屋**：猫碗、猫砂角、抓挠设施、二楼猫窝、露台和楼梯；可通过设施菜单安排进食、刨砂、休息与上楼探索。
- **追球小游戏**：在小屋庭院点击抛出毛线球，60 秒内追到 5 次。
- **建模方法**：补充技术总结、照片投射与五官修补的具体流程，区分已实现能力和后续雕刻需求。

局限：两只猫尚未分别重建头部拓扑；口鼻覆盖属于修补，眼周和耳根仍有投射拉伸。没有专业 Groom 毛发、真实动作捕捉、完整落地物理或完整定制 GLB 导出。构建通过不代表相似度验收通过。

## 运行与构建

需要 Node.js 22 或更高版本，首次安装依赖需要联网。

```sh
npm ci
npm run dev
# 世界：http://127.0.0.1:5188
# 五官工作台：http://127.0.0.1:5188/coat-review.html
```

```sh
npm test          # 数据、曲面、蒙皮和导航检查
npm run build     # 构建世界页面与五官工作台
npm run desktop   # 先 build，再启动 Electron
npm run package   # macOS Apple Silicon 桌面打包
```

打包输出到 `desktop/build/Pawprints-darwin-arm64/Pawprints.app`。Python 毛色重烘焙为可选制作步骤，运行 App 无需 Python；输入照片及配准要求见 [方法说明](modeling/METHOD.md#3-照片花色烘焙)。操作、互动与资料备份见 [APP-README.md](APP-README.md)。

## 目录

| 位置 | 内容 |
| --- | --- |
| `modeling/` | 独立建模方法、Agent 指令、模板与验收方式 |
| `public/models/` | 授权基础 GLB、薯片及羊羊的烘焙毛色贴图 |
| `public/seed/` | 已随旧仓库提供的 12 张相册照片；不是新烘焙参考编号组 |
| `src/cat*.js` | 形体、曲面、五官、蒙皮、毛发与 IK 动作 |
| `scripts/bake-cat-coats.py` | 当前照片 UV 烘焙脚本，需按目标照片重新配准 |
| `coat-review.html`、`src/coat-review.js` | 中性灯光下的脸部、花色与动作对照工作台 |
| `src/garden.js`、`src/habitat*.js` | 原野、镜头、互动小屋及导航 |
| `electron/` | 桌面窗口、媒体存储、备份与恢复 |
| `desktop/` | 版本下载说明与 SHA-256 校验值 |
| `CAT-MODELING.md`、`COAT-REWORK-HANDOFF.md` | 早期制作和交接记录；当前事实以 METHOD 与版本说明为准 |

## 许可

原创代码与文档使用 [MIT](LICENSE)。第三方猫模型及其衍生修改遵循 **CC BY 4.0**，保留 guillaume bolis、kenchoo 的署名、来源和修改说明。真实照片的权利不随代码许可转让；已有照片用于展示和参考，其他用途请联系仓库所有者。见 [ATTRIBUTION.md](ATTRIBUTION.md)。
