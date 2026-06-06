# Prettier Plugin Maafw Sort — 技术架构

## 模块架构

```
src/
├── index.ts          # 插件入口: parsers, options, patchPlugin()
├── option.ts         # Prettier 选项定义和 parseOption()
└── parser.ts         # 核心排序逻辑
                      #   - createJsonParser(): 包装 Prettier babel JSON 解析器
                      #   - transform(): AST 后处理遍历
                      #   - sortObject(): 属性重排
                      #   - mapArray(): 数组元素排序
```

## 排序算法

### Pipeline 模式 (sortObject)

```
1. 提取所有属性
2. 按标准任务 key 顺序排列:
   algorithm → template → text → roi → action → sub → next → ...
3. 对 recognition 子对象: type → param
4. 对 action 子对象: type → param → swipes → ...
5. 对不识别的 key 保持原位（相对于它们首次出现的位置）
6. 递归处理嵌套对象
```

### Interface 模式 (findOverrides)

```
1. 递归遍历 interface JSON
2. 查找所有 pipeline_override 条目
3. 对每个 override 应用 sortObject
```

### 插件共存 (patchPlugin)

```
1. 遍历目标插件的 parsers
2. 对 json/jsonc 解析器应用排序包装
3. 对非 json/jsonc 解析器直接保留
```

## 依赖关系

### 外部依赖

| 包 | 用途 |
|---|---|
| `@babel/types` | AST 节点构造和验证 |
| `prettier` | peer 依赖，Prettier 插件 API |

## 技术选型

| 选择 | 理由 |
|---|---|
| Babel AST (`@babel/types`) | Prettier 内部使用 Babel 解析 JSON，复用 AST 避免额外解析 |
| 后处理模式 | 在 Prettier 格式化前插入，确保排序后仍由 Prettier 格式化 |
| `patchPlugin()` | 解决多插件冲突，允许与其他 JSON Prettier 插件共存 |
| 正则文件过滤器 | 精确控制插件作用域，避免影响非 MAA 的 JSON 文件 |
