# 爪印 · Pawprints Cat Modeling

猫咪三维角色、桌面原野应用，以及**独立于 App 的照片参考建模方法**。

这个仓库包含两类内容：

- **给 Agent 的建模流程**：用户把自己的猫咪照片交给 Agent，按流程制作自己的三维猫，最后在独立查看器、游戏或其他项目中展示。无需安装《爪印》。
- **《爪印》0.2.1 示例工程**：薯片和羊羊、可探索的三维原野、走跑跳、相册、时间线和游记。它展示了方法的一种实际实现。

> 建模指南不是“一键照片转写实 3D”的在线服务。当前 App 仍是薯片、羊羊两只固定角色；没有加入照片自动建模入口。通用流程由用户自己的 Agent 执行，工具、素材、建模和验收结果需要如实记录。

## 直接开始

1. 阅读 [通用建模流程](modeling/WORKFLOW.md)。
2. 将 [Agent 任务指令](modeling/AGENT-PROMPT.md) 和自己的照片一起交给 Agent。
3. 使用 [猫咪特征模板](modeling/templates/cat-profile.json) 和 [验收清单](modeling/ACCEPTANCE.md) 记录目标与结果。
4. 看 [薯片与羊羊案例](modeling/examples/shupian-yangyang.md)，理解照片特征如何转成模型调整。

## 下载桌面版

[下载 Pawprints 0.2.1 · macOS Apple Silicon](https://github.com/2857577361/pawprints-cat-modeling/releases/tag/v0.2.1)

解压 `Pawprints-0.2.1-macOS-arm64.zip`，将 `Pawprints.app` 放进“应用程序”。当前为本机开发构建，未做 Apple 公证；不含 Windows 或 Intel Mac 安装包。安装包与 SHA-256 校验文件保存在本仓库 Releases，说明见 [desktop/README.md](desktop/README.md)。

## 目录

| 位置 | 内容 |
| --- | --- |
| `modeling/` | 通用、独立的建模流程、Agent 指令、参数模板与验收方式 |
| `public/models/companion-cat.glb` | 授权基础猫模型；不是两只定制猫的独立成品 GLB |
| `public/seed/` | 薯片、羊羊的 12 张参考照片 |
| `src/cat*.js` | 曲面、蒙皮、花色、毛发和足端 IK 动作的示例实现 |
| `src/garden.js` | Three.js 原野和镜头控制 |
| `src/main.js`、`src/storage.js`、`src/domain.js` | 界面、相册与资料管理 |
| `electron/` | 桌面文件存储、备份和窗口 |
| `desktop/` | 桌面下载说明、校验清单 |
| `ATTRIBUTION.md` | 模型作者、来源、许可和修改说明 |

## 运行示例工程

需要 Node.js 22 或更高版本。首次安装依赖需要联网。

```sh
npm ci
npm run dev
# 打开 http://127.0.0.1:5188
```

```sh
npm test           # 数据、曲面与蒙皮回归检查
npm run build     # 构建前端
npm run desktop   # 先 build，再启动 Electron
npm run package   # 在 macOS 上构建 Apple Silicon 桌面包
```

桌面打包输出到 `desktop/build/`。详细操作和数据备份说明见 [APP-README.md](APP-README.md)。

## 示例建模方式

现成骨骼模型 → 局部形体调整 → 静止坐标花色 → 弯曲毛片 → 蒙皮修正 → 程序化足端 IK → 场景展示。实际实现说明见 [REUSABLE-CAT-MODELING.md](REUSABLE-CAT-MODELING.md)。

0.2.1 修复了后腿内侧和尾端的错误权重、后腿收起时的膝盖翻折，以及急转弯时超出可达范围的落脚预测。当前仍有形体、毛流和动作精修空间，没有达到照片级数字孪生品质。

## 许可

本项目原创代码与原创文档采用 [MIT](LICENSE)。第三方猫模型及其衍生修改遵循 **CC BY 4.0**，必须保留 guillaume bolis、kenchoo 的署名和来源。真实照片的权利不随代码许可转让；本仓库中的照片用于展示和参考，其他用途请联系仓库所有者。详见 [素材署名](ATTRIBUTION.md)。
