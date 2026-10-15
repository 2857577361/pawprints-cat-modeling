# 可复用猫咪建模方法

当前示例版本为 **0.3.2 五官修整预览**。完整、与源码对齐的技术说明已整理到 [modeling/METHOD.md](modeling/METHOD.md)。

实际技术组合：Three.js + 授权 GLB 骨骼模型改造 + JavaScript 局部顶点变形 + Phong 曲面细分 + Python/NumPy/Pillow 照片 UV 烘焙 + 程序化几何毛发与五官 + GLSL 虹膜 + 骨骼蒙皮与足端 IK。

## 根据目标选择入口

| 目标 | 文档 |
| --- | --- |
| 了解用了什么技术、每一步如何实现及当前限制 | [当前建模技术与方法](modeling/METHOD.md) |
| 让自己的 Agent 依据照片制作另一只猫 | [通用工作流](modeling/WORKFLOW.md)、[Agent 任务指令](modeling/AGENT-PROMPT.md) |
| 记录照片证据和角色特征 | [角色模板](modeling/templates/cat-profile.json)、[资产适配模板](modeling/templates/asset-adapter.json) |
| 检查长相、毛发、动作和交付物 | [验收清单](modeling/ACCEPTANCE.md) |
| 查阅照片投射和五官修整的具体修改 | [0.3.1 花色](modeling/COAT-REWORK-0.3.1.md)、[0.3.2 五官](modeling/FACE-REWORK-0.3.2.md) |

## 相比旧版的变化

0.2.1 主要将原始纹理与静止空间程序化花色遮罩组合。0.3.1 起，当前角色默认使用照片采样烘焙的 2048² 毛色贴图，身体与毛发共享；程序化颜色逻辑保留为回退及对照。0.3.2 将虹膜坐标改为源空间眼球位置驱动，补充独立鼻革、眼睑、人中和唇线，并修改眼眶、耳形和下巴。

两只猫仍共用 Fripouille 衍生基础拓扑；没有完成分别雕刻头部、真实照片扫描重建、专业 Groom 毛发、完整物理动作或定制成品 GLB 导出。嘴槽覆盖仍是修补方案，眼周与耳根的花色投射存在拉伸。当前相似度不足，不能将版本号或构建通过当成写实质量验收通过。

该方法由用户自己的 Agent 执行，独立于《爪印》。示例 App 没有接入照片自动建模服务。
