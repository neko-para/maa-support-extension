# Maa Support Extension

[文档](./release/README.md)

## 开发

```shell
pnpm i
npm run dev   # dev模式启动前端, 可热重载, 使用Run Extension进行调试
npm run watch # build模式启动前端, 不可热重载, 使用Run Extension As Release进行调试
```

### pkgs/extension

插件后端

### pkgs/webview

插件前端

### pkgs/types

前后端公用类型

### pkgs/utils

后端工具

---

端口使用情况

|          | 端口  | 配置来源                       | 获取                  |
| -------- | ----- | ------------------------------ | --------------------- |
| Vsc Lsp  | 60001 | Vsc Ext 请求                   | `/lsp/start` 请求参数 |
| Support  | 60002 | Vsc Ext 启动                   | support 启动参数      |
| Web Dev  | 60003 | vite 配置                      | query                 |
| Vsc Host | 60005 | support 启动参数, 来自 Vsc Ext |                       |
