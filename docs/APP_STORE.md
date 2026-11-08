# 应用市场提交资料

依据：[发布应用](https://docs.halo.run/developer-guide/app-store/publish-app)、[应用市场审核指南](https://docs.halo.run/developer-guide/app-store/app-review-guidelines)、[插件发布验收清单](https://docs.halo.run/developer-guide/plugin/release-checklist)。

## 可填写的信息

| 项目 | 内容 |
| --- | --- |
| 类型 | 免费插件 |
| 应用名称 | 富文本内容容器 |
| 插件标识 | `richtext-containers` |
| 开发者 | shenbourne |
| 简介 | 为 Halo 默认富文本编辑器增加可嵌套的选项卡、幻灯片、提示容器和脚注，正文保持原生富文本编辑。 |
| 首个版本 | `1.0.0` |
| Halo 范围 | `~2.27.1`；验收基线为 `2.27.1` |
| 源码、主页 | https://github.com/shenbourne/halo-plugin-richtext-containers |
| 支持 | https://github.com/shenbourne/halo-plugin-richtext-containers/issues |
| 许可证 | GPL-3.0；根目录 LICENSE |
| Logo | `src/main/resources/logo.svg`；原创，无 Halo 默认图标 |
| 截图 | `docs/screenshots/` 中的实际编辑器与阅读页面 |
| 详情 | 根目录 README.md |
| 版本说明 | 根目录 CHANGELOG.md 中的 1.0.0 条目 |
| 隐私、数据处理 | `docs/PRIVACY.md` |
| 迁移、卸载 | README.md 与 `docs/MIGRATION.md` |

如果市场上传控件不接受 SVG，可使用 `docs/logo.png`（512×512）；两者来自同一原创图形。

## 审核说明要点

插件通过默认编辑器扩展点注册八种原生节点，阅读端通过标准 Head 扩展和静态资源代理运行。没有额外业务 API、后台轮询、数据库或外部服务，不需要测试用第三方账户。验证时在默认编辑器「插入内容（+）」中选择组件，保存文章或独立页面，再打开前台。可在编辑器从下拉菜单选择已有脚注名称，前台按首次引用顺序编号。演示正文使用合成内容。

初始功能同时包含选项卡、幻灯片、提示容器和脚注，不要求安装 KaTeX；只有需要在正文中使用公式等其他组件时，才安装其对应插件。免费，无隐藏付费能力、遥测、AI 服务或远程核心代码加载。

基于 Halo 官方插件模板的工程方式开发，保留 GPL 许可证；非已有第三方容器插件的换名发行。Reveal.js、fitty 的来源与 MIT 许可证见第三方声明。AI 辅助重构的部分仍需维护者在提交前复核，自动化检查及实机证据见验收记录。

## 提交顺序与边界

1. 维护者复核源码、授权、截图、最终 SHA-256 及验收记录。
2. 将最终源码推送到上述仓库，确认主页、README、LICENSE 和 Issues 入口公开可访问。发布 commit 的 CI 应通过。首次审核前仅上传正式 1.0.0 制品。
3. 申请开发者身份并创建免费应用。取得真实市场 ID 后，可在 `plugin.yaml` 添加 `store.halo.run/app-id`；不得填虚构 ID。该注解不是首次安装的强制条件。
4. 应用保持草稿，只创建一个 `1.0.0` 初始草稿版本，上传本次构建的 JAR。历史本地实验包不上传、不复用。
5. 填写真实测试说明，阅读并同意平台协议后提交审核。审核结论由 Halo 运营方决定；本地自查不能保证通过。
6. 首次审核通过前，CD 保留 `skip-appstore-release: true`。通过后才配置真实 app-id 及最小权限 HALO_PAT。仓库中不得保存令牌。

审核期间平台保存提交快照。需要修改资料或制品时，按平台要求取消审核或待驳回后重新提交。已经公开发布的版本不得替换制品，应使用更高版本修复。

## 对照证据

| 条款 | 工程中的落实 |
| --- | --- |
| 2.1 / 2.3 完整性与兼容性 | 最终 JAR 校验、类型检查、前后端测试、Halo 2.27.1 生命周期验收 |
| 2.2 上架信息 | plugin.yaml、README、真实截图、版本说明及支持链接 |
| 4.3.1 最小权限 | 无自定义业务接口或额外角色权限；静态代理只暴露 assets |
| 4.3.2 / 5.1 数据边界 | 原生文档存储、localStorage 标签选择及卸载保留说明 |
| 4.3.3 网络服务 | 所有业务资源随 JAR 本地提供，无第三方出站服务 |
| 4.3.4 生命周期 | 插件标准入口、扩展注册；迁移、停用、卸载与页面刷新说明 |
| 4.3.5 构建制品 | check 接入前端测试与归档验证、版本从 Gradle 注入、CI/CD |
| 5.2 授权 | GPL-3.0、第三方 MIT 声明、原创 SVG Logo |

各项实际通过情况以 `docs/ACCEPTANCE.md` 为准，未验证项不得写成已经通过。
