# Maa Support Extension

[文档 | Document](./release/README.md)

## 开发 | Development

```shell
pnpm i
npm run dev   # dev模式启动前端, 可热重载, 使用Run Extension进行调试
npm run watch # build模式启动前端, 不可热重载, 使用Run Extension As Release进行调试
```

### pkgs/extension

插件后端 | backend of extension

### pkgs/webview

插件前端 | frontend of extension

### pkgs/types

前后端公用类型 | common types for both the frontend and backend

### pkgs/utils

后端工具 | backend tools

### pkgs/locale

国际化文案 | Localization texts

### pkgs/maa-server

MaaFw 独立服务进程 | MaaFw standalone service process

### pkgs/maa-server-proto

MaaFw 服务协议 | MaaFw service protocol

### pkgs/pipeline-manager

索引服务 | index service

### pkgs/maa-tasker

Maa 任务解析计算库 | Maa task parser & evaluator

### pkgs/maa-checker

@nekosu/maa-checker

### pkgs/simple-parser

simple LL(\*) parser
