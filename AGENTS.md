你正在开发一个 Tampermonkey userscript 项目 — 小红书工位伪装壳层。

## 项目结构
- `src/` — TypeScript 源码，按模块拆分
- `dist/` — Vite 构建输出，自动生成
- `xhs-dev-loader.user.js` — 油猴 dev loader，@require 指向本地 dist

## 规则
1. 只修改 `src/` 下的源码，不要直接改 `dist/`。
2. 每次修改后说明需要我刷新哪个页面验证。
3. 这是小红书 Web 页面增强脚本，页面是 SPA，要注意路由变化和重复注入。
4. 所有 DOM 注入都必须有唯一 root id（`xhs-wb4-app`），避免刷新列表或切换详情时重复创建。
5. 使用 MutationObserver 时必须做防抖和 cleanup。
6. 不直接依赖脆弱的 class 名，优先用结构、文本、href、role、稳定属性组合选择。
7. 控制台日志统一用 `[XHS Workbench Shell]` 前缀。
8. 开发环境保留 debugger 和 console，生产构建再清理。
9. 模块间禁止使用 `require()`，用 import/export 和回调参数传递依赖。

## 构建与调试
```bash
pnpm dev    # Vite watch 模式，自动输出 dist/xhs-shell.iife.js
pnpm build  # 单次构建
```

Chrome/Edge 需要：扩展管理 → Tampermonkey 详情 → 允许访问文件网址
