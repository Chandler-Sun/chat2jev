# GitHub 开源发布清单

这份清单用于发布前复核，不代表已经完成所有 GitHub 设置。2026-09-22 只读确认远程仓库已经是 Public，默认分支为 main；本次准备没有更改可见性或创建 Release。

## 本地准备

- [ ] 确认拥有代码与素材的公开发布权，并接受 MIT 许可证。
- [ ] 审查全部未提交变更，确保个人配置和路由数据没有进入提交。
- [ ] 对工作树与全部 Git 历史运行密钥扫描；人工检查业务数据、私有地址和截图。正则扫描无命中不保证不存在秘密。
- [ ] 从全新目录运行 `npm ci`，再执行 lint、typecheck、test、build。
- [ ] 用自己的测试 Key 验证转换、对比、内置代理路由；涉及部署时验证 Worker 预览和 KV 持久化。
- [ ] 运行 `npm audit`，审查生产与构建依赖风险；不要未经验证执行 `npm audit fix --force`。
- [ ] 保留所有第三方许可声明，检查文档中的链接、示例及已知限制。

## GitHub 设置

- [ ] 确认目标仓库为 `Chandler-Sun/chat2jev`，审查仓库可见性后再决定是否设为 Public。
- [ ] 填写简介：`Convert chat requests into reusable TypeSafe Jev judgments.`
- [ ] 可选 topics：`typesafe`、`jev`、`nextjs`、`typescript`、`llm`、`cloudflare-workers`。
- [ ] 启用 Private vulnerability reporting，检查 Secret scanning 与依赖安全告警的可用性。
- [ ] 推送后确认 CI 通过，为默认分支配置 Pull Request 和 `Quality checks` 必须通过的规则。
- [ ] 如提供在线演示，先按 SECURITY.md 配置访问控制；不要公开一个未保护的代理服务。
- [ ] 核对版本号与更新说明，再创建首个 tag / GitHub Release。

实际创建 Release、切换仓库可见性和部署演示应在上述内容核对后执行。

## 2026-09-22 本地准备记录

- 已补充 README、MIT LICENSE、贡献与安全说明、代理文档及 GitHub 模板。
- 已添加 Node.js 22 配置与 CI（代码规范、类型、测试、构建和高危依赖审计）。
- 修正密钥传输说明，修复面板布局存储导致的服务端构建失败。
- 用 PostCSS 8.5.28 覆盖 Next.js 的旧间接依赖；安装后的 npm 审计为 0 个已知漏洞。
- 当前工作区 lint、typecheck、17 项测试与生产构建通过。
- 对待提交文件及本地所有 Git 引用可达的历史进行了常见凭据格式扫描，未发现匹配；这不是全面安全审计，也不覆盖远程未获取的引用。
- 本次没有运行真实模型付费调用、Worker 部署，也没有推送、创建 Release 或修改 GitHub 仓库设置。
- 隔离副本（不包含 `.dev.vars`、本地数据和原有 `node_modules`）也通过 lint、typecheck、17 项测试及生产构建。在线安装曾停滞，重试使用 `npm ci --offline --no-fund --no-audit` 从下载缓存全新安装成功；依赖在线审计已在工作区单独完成。
