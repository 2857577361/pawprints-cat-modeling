# 素材署名与改动

## 本轮猫咪基础模型

猫咪模型重做采用 **Bicolor Cat — kenchoo**，该作品由 **guillaume bolis** 的 **3d modelling my cat: Fripouille** 重建并加入动画。两位作者的贡献和来源均保留署名。

- 原始模型：[Fripouille — guillaume bolis](https://sketchfab.com/3d-models/3d-modelling-my-cat-fripouille-0ab14bf98e754f8d90fe1bf1c84ca66c)
- 重建与动画版本：[Bicolor Cat — kenchoo](https://sketchfab.com/3d-models/bicolor-cat-e623a618ca344a8393d7ba4d63ec23cf)
- 公开 GLB 分发源：[code4fukui/vr-cats](https://github.com/code4fukui/vr-cats/blob/main/bicolor_cat.glb) · [直接下载](https://raw.githubusercontent.com/code4fukui/vr-cats/main/bicolor_cat.glb)
- 模型许可：[Creative Commons Attribution 4.0 International（CC BY 4.0）](https://creativecommons.org/licenses/by/4.0/)
- 分发仓库的[模型署名说明](https://github.com/code4fukui/vr-cats#3d-models-and-attribution)及 kenchoo 原作品页均确认上述许可。仓库的 MIT 代码许可不替代模型的 CC BY 4.0。

本项目衍生修改范围为：根据薯片、羊羊照片调整体型及脸部比例，制作各自花色、眼睛和毛发，适配骨骼与运动控制，并制作或调整走路、奔跑、跳跃动作。此处说明修改范围，不表示全部动作已经完成或验证；设计依据和验收方法见 [CAT-MODELING.md](CAT-MODELING.md)。原作者不为本应用或修改后的外观背书。

分发模型及其衍生版本时，应保留两位作者姓名、作品链接、CC BY 4.0 链接和修改说明。

### 原版文件内嵌证据

2026-10-05 下载的原版 `bicolor_cat.glb` 为 2,297,972 字节，SHA-256：

```text
4b395ba943d647f4c490c982a70fa2175ef91569615773da7ef3429e427ed21a
```

其 glTF JSON 块的 `asset.extras` 可直接核对：

```json
{
  "author": "kenchoo (https://sketchfab.com/kenchoo)",
  "license": "CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)",
  "source": "https://sketchfab.com/3d-models/bicolor-cat-e623a618ca344a8393d7ba4d63ec23cf",
  "title": "Bicolor Cat"
}
```

guillaume bolis 的前序创作署名来自 kenchoo 原作品页的明确说明，不能因为 GLB 元数据只写 kenchoo 而省略。

## 旧版素材的历史署名

之前的 `cat-base.fbx` 来自 **JonasDichelle — Rigged and animated Cat**，采用 [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)。本轮以新的 Bicolor Cat 基础替换旧版；若源码包仍包含旧 FBX 或历史实现，以下署名继续适用于该文件：

- [原作品](https://blendswap.com/blend/18519)
- [FBX 分发目录](https://github.com/nrz/ylikuutio/tree/master/res/objects/www.blendswap.com/86110_rigged_and_animated_cat)
- [分发仓库许可说明](https://github.com/nrz/ylikuutio#3d-models)

没有使用 Ylikuutio 引擎源代码。旧版衍生模型与动作不属于新原作者的作品。

## 照片、场景与依赖

参考照片由项目所有者提供，并授权随本公开仓库作为角色参考与展示发布。照片没有发送至外部建模服务。照片版权不受本项目 MIT 或模型 CC BY 4.0 许可覆盖；其他用途请联系仓库所有者。

草地、树木、远山、湖水、花、蝴蝶和界面由本项目代码构建；界面图标使用 Lucide。Three.js、Lucide、Electron 等依赖的版权与许可保留在对应依赖包中。
