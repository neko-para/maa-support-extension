下面是针对不同文档的修改建议/要求

## specs

不同模块中，有大量重复内容。monorepo中国基本共享同一套配置。将通用的specs抽离，其它文档引用即可。

## extension/models

1. 明确：MaaAssistantArknights的支持是有限的。
2. 文档中，MaaAssistantArknights专用的功能需要标注
3. 外部分析器 是指 [MaaLogAnalyzer](https://github.com/MaaXYZ/MaaLogAnalyzer)
4. 明确：MaaAssistantArknights的pipeline json本身的语法也不完全一样
5. 明确：pipeline json的静态语法分析由官方的json schema实现，不属于插件的业务

## extension/specs

1. VSCode命令命名没有经过统一设计，算是历史遗留问题。

## maa-locale

这个包算是一个设计失误。本意是避免插件和checker的文案不一致，但是直接发布导致版本更新不明确。

## maa-pipeline-manager

1. 明确：模块内依赖了node的能力。这是一个设计失误，导致其无法在browser环境中使用，即使做了fs层的抽象接口。
2. 明确：该项目有一个已知罕见bug。（在插件和checker同时执行）有概率错误删除所有图片文件（可能还有其它文件）。但是代码层面没有任何删除操作。怀疑和watch库有关，但理论上不应该发生。

## maa-pipeline-manager/models

1. reco/action对象是MaaFramework V2语法；baseTask和@表达式是MaaAssistantArknights语法。
2. 明确：格式切换 功能是实验性的，会丢失注释。实际上目前官方推荐使用其它方法迁移。
3. 补充：支持注入custom reco/act解析器，获取自定义识别/操作的参数中的引用。
4. 明确：3中提到的自定义解析器，目前存在局限性，无法转发pipeline_override格式的内容，且ast产物和标准解析的产物完全隔离，是设计失误。标注到TODO中。

## maa-pipeline-manager/specs

1. 明确：事件驱动 是一个历史遗留问题。这导致checker侧使用困难。

## maa-server/models

1. 控制器类型属于MaaFramework本身的信息，不需要列出
2. 不需要指名 PaddleOCR，这是MaaFramework的技术细节

## maa-tools/models

1. 明确：/pm导出主要服务于自定义custom reco/action的parser。详情参考配置

## maa-version-manager/models

1. 明确：由于pacote的技术限制，无法获取到下载本身的进度

## webview

1. 明确：ControlPanel侧，目前全量同步State时，由于interface对象可能过大，导致vue响应式对象重建延迟严重。因此，针对高频率修改（text input）实现了临时性的debounce策略来缓解。这里有两个预期修改：将interface文件隔离出主state，但是这个state是由utils模块提供的固定能力；使用某种更精确的方案来进行状态同步，但是interface对象本来就是从文件全量parse而来，无法通过文件编辑信息来优化。将这个问题同步到TODO。
2. immer依赖是曾经为了解决上述问题引入的包，但是发现收益有限，因此没有实际使用。package中的依赖是历史问题。
