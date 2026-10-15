# 桌面安装包

[0.3.2 五官修整预览版](https://github.com/2857577361/pawprints-cat-modeling/releases/tag/v0.3.2) · [历史版 0.2.1](https://github.com/2857577361/pawprints-cat-modeling/releases/tag/v0.2.1)

下载 `Pawprints-0.3.2-macOS-arm64.zip`，解压并将 `Pawprints.app` 拖到应用程序目录。适用于 Apple Silicon Mac，是未做 Apple 公证的开发构建。首次运行保留原有资料目录；更新前可从应用设置导出资料备份，说明见 [APP-README.md](../APP-README.md)。

0.3.2 包含照片花色烘焙、局部五官修整、两层互动小屋与追球游戏，整体长相仍有共享底模限制，因此以预发布版分发。相似度尚未通过用户验收。

安装包作为 GitHub Release 附件分发，Git 历史保留源码、模型、贴图和方法文档。校验命令：

```sh
shasum -a 256 Pawprints-0.3.2-macOS-arm64.zip
```

与仓库中的 [SHA256SUMS.txt](SHA256SUMS.txt) 对应版本一行比对；Release 附件列表也会显示安装包的 SHA-256。

0.3.2 安装包校验值：`92aa382ef58564e0aec4fb447e49525c007493e28078a8898e117485f637430f`。

从源码构建：

```sh
npm ci
npm run package
```

输出为 `desktop/build/Pawprints-darwin-arm64/Pawprints.app`。首次安装依赖与 Electron 运行时需要联网。Python 只用于可选贴图制作，不是运行桌面版的依赖。

