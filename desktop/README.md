# 桌面安装包

[GitHub Releases · v0.2.1](https://github.com/2857577361/pawprints-cat-modeling/releases/tag/v0.2.1)

下载 `Pawprints-0.2.1-macOS-arm64.zip`，解压并将 `Pawprints.app` 拖到应用程序目录。仅适用于 Apple Silicon Mac；是未做 Apple 公证的开发构建。

安装包约 146 MB，超过 GitHub 普通 Git 文件 100 MiB 限制，因此作为本仓库 Release 附件分发，而不直接提交到 Git 历史。参见 [GitHub 大文件说明](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)。

下载后可使用：

```sh
shasum -a 256 Pawprints-0.2.1-macOS-arm64.zip
```

与本目录 `SHA256SUMS.txt` 比对。源代码、基础模型和参考照片都已放在仓库中，不需要从桌面程序中提取。

从源码构建：在 macOS 上执行 `npm ci`、`npm run package`，输出为 `desktop/build/Pawprints-darwin-arm64/Pawprints.app`。首次安装依赖和 Electron 运行时需要联网。
