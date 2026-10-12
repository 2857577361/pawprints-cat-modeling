# 薯片与羊羊的模型重做说明

本轮重做两只猫的形体、花色、毛发和动作，继续沿用已认可的世界场景与记录功能。资料检索日期：2026-10-05。

## 先建立正确的猫科形体

选用 [Bicolor Cat — kenchoo](https://sketchfab.com/3d-models/bicolor-cat-e623a618ca344a8393d7ba4d63ec23cf)，原始形体来自 [Fripouille — guillaume bolis](https://sketchfab.com/3d-models/3d-modelling-my-cat-fripouille-0ab14bf98e754f8d90fe1bf1c84ca66c)。原作者使用 Blender 建模、Substance Painter 绘制纹理，kenchoo 重建并加入动画。完整署名和许可见 [ATTRIBUTION.md](ATTRIBUTION.md)。

这套基础已有连贯的猫科轮廓、真实表面 UV 和蒙皮结构，可先解决头脸、肩背、腹部与四肢的连接。基础猫不等于薯片或羊羊，还需要分别校准比例、花色与毛长。

已解析的原版 GLB 包含 **40 个关节**的一套蒙皮骨架、三个内嵌图像、两个材质和一个名为 `Animation` 的片段。片段有 38 条通道，时长约 **8.708 秒**。这些数字只描述源文件；它没有以名称区分独立 walk/run/jump 片段，不能仅凭“带动画”就认定各种动作已满足本项目要求。

## 两只猫各自的辨认特征

以下来自用户照片中的外观观察，不推断品种或照片未展示的细节。

| 部位 | 薯片 | 羊羊 |
| --- | --- | --- |
| 总体 | 银灰色长毛感，脸颊、胸颈和尾巴蓬松 | 白色为主，短毛，身体轮廓清晰 |
| 头脸 | 额头与眼侧深灰虎斑，浅色口鼻和下巴，鼻革较深 | 白色面部中线，左右花色不对称，粉色鼻革有深边 |
| 耳朵 | 较大直立耳，耳内灰粉，耳缘有细毛 | 直立耳，耳内粉色，耳根和额头有橘色及深色斑块 |
| 眼睛 | 照片中为金绿至黄绿色，眼周深色 | 照片中为黄绿色，深色眼线清晰 |
| 身体 | 灰色虎斑，浅色胸腹，部分脚掌与脚趾偏白 | 大部分身体和四肢为白色，花色集中于头部、臀尾 |
| 尾巴 | 长而蓬松，灰色深浅变化 | 较细，橘色与深色环纹，尾端较深 |

羊羊正面照片的画面左侧头部偏橘、右侧偏深色虎斑。贴图需区分“照片画面左右”和“猫自身左右”，避免镜像。不完整展示的背侧、腹底和耳后按已知区域自然延续，不声称还原未观察到的细节。

## 表面、花色和毛发

先关闭毛发，从正面、45 度、侧面检查眼距、耳位、口鼻长度、胸深和腿长，再加毛。毛量不能修复错误脸形或关节。

保留基础拓扑、UV、原骨骼绑定空间和可靠蒙皮权重。调整体型时同时检查对应骨骼位置；眼睛、鼻子、耳朵、胡须都随头部骨骼移动。毛根的蒙皮权重从承载表面的三角形插值，避免腿或尾巴运动时毛发脱离。

照片用于判断花纹、色彩和形体，不能把整张脸平面投射到模型上。照片里已有眼睛、鼻子、阴影，叠到独立眼球和鼻子上会产生重影、贴纸感和侧面拉伸。花纹应落到模型 UV；固有颜色、凹凸、粗糙度和实时照明分别处理。

毛发按分区设置方向和长度：额头向后、脸颊向外下、胸颈向下、背部向尾、四肢沿肢体、尾毛向梢。薯片保留更长的胸颈、腹部和尾部毛；羊羊短毛保留清晰体型。脸毛短且细，不遮住眼睑和鼻革。发根与底网格共享同一花色，避免独立随机跳色。

近处保留细毛的弯曲、渐细和轮廓，远处降低数量。Blender 导向曲线插值、Epic strands/cards 和 AMD TressFX 的绑定与 LOD 是方法参考。本项目使用 Three.js，不表示集成了这些引擎或完整毛发系统。

## 走路、奔跑与跳跃

优先保留并验证原骨骼和权重。新增动作由脚掌目标和落地时序驱动身体，不能把同一组四肢正弦加快就称为奔跑。

- **慢走**：四脚依次落地，支撑时间比摆动长；身体平顺，肩和骨盆轻微相对运动，支撑脚尽量固定地面接触点。
- **小跑**：两组对角肢交替支撑，与慢走时序分开；按实际位移推进循环，停止后不继续原地蹬腿。
- **奔跑**：前后躯具有不同相位，脊柱伸展与收拢，后肢推进、前肢接住身体。家猫有多种疾跑方式，单一循环不代表所有速度。
- **后腿**：保留髋、向前的膝、向后的跗关节及趾部着地关系，不能套用前腿折叠方向。
- **跳跃**：分蓄力下蹲、后肢蹬伸、腾空收腿、前掌落地和缓冲恢复；身体轨迹与姿势分别控制，避免只有整体上下漂移。

文献正常步行实验中的后肢支撑比例约 0.60、前肢约 0.64，可用作调参起点。这不是对薯片或羊羊的测量；步幅、频率和混合时间还需通过画面校准。

## 验收方式

两只猫分别检查正面、左右 45 度、侧身、俯视和近脸。要分别判断“像一只猫”和“像这只猫”；关闭毛发后形体也应成立，不能用花纹遮掩错误眼位或口鼻。

用低机位连续查看慢走、奔跑和一次完整跳跃，检查滑步、穿地、关节折叠及落地缓冲。单张截图只能证明静态外观。另需检查骨骼与毛发同步、蒙皮权重有效，以及近景和世界视角的渲染开销。本文是设计依据与验收方法，不代替实际测试结果，也不承诺照片级重建精度。

## 方法来源

- [Klishko 等：Stabilization of cat paw trajectory during locomotion（2014）](https://pmc.ncbi.nlm.nih.gov/articles/PMC4137248/)：支撑、摆动阶段及猫爪轨迹实验。
- [Pearson 等：Leg mechanics contribute to establishing swing phase trajectories（2015）](https://www.frontiersin.org/journals/computational-neuroscience/articles/10.3389/fncom.2015.00116/full)：后腿分段与关节对脚掌轨迹的作用。
- [Martin 与 Neff：Interactive Quadruped Animation](https://web.cs.ucdavis.edu/~neff/papers/CAT_MiG.pdf)：足迹规划、逆运动学、脊柱和地形纠正。
- [Smith 等：Kinematics of treadmill galloping by cats I（1977）](https://www.sciencedirect.com/science/article/pii/S0091677377922799)：多种家猫疾跑步态。
- [Blender：Interpolate Hair Curves](https://docs.blender.org/manual/en/5.1/modeling/geometry_nodes/hair/generation/interpolate_hair_curves.html)：少量导向曲线控制附着表面的密集毛发。
- [Epic：Hair Rendering and Simulation](https://dev.epicgames.com/documentation/unreal-engine/hair-rendering-and-simulation-in-unreal-engine)：实时毛发、毛束、绑定和可扩展渲染。
- [AMD GPUOpen：TressFX](https://github.com/GPUOpen-Effects/TressFX)：发丝蒙皮、模拟与细节层次。
- [Three.js：SkinnedMesh](https://threejs.org/docs/pages/SkinnedMesh.html)：骨架、权重与绑定空间。
