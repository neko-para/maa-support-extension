这是一个针对MaaFramework框架和MaaAssistantArknights项目的VSCode插件和命令行工具（checker）的monorepo。

> MaaFramewor的内容请查阅 github.com/MaaXYZ/MaaFramework
> MaaAssistantArknights的内容请查阅 github.com/MaaAssistantArknights/MaaAssistantArknights

请分析当前项目，按照要求生成文档信息。

- extension为插件的主pkg
- maa-locale是插件和checker的共享文案包
- maa-pipeline-manager是核心的语法解析支持库
- maa-server是加载MaaFramework并执行任务的代理进程（用来解决插件无法以管理员启动的问题）
- maa-server-proto是插件和server共享的通信协议
- maa-tasker是解析MaaAssistantArknights专有的任务resolve机制的库
- maa-tools是checker的主pkg
- maa-version-manager是使用pacote动态下载和管理不同版本的@maaxyz/maa-node的库
- prettier-plugin-maafw-sort是针对pipeline提供的prettier插件
- simple-parser是一个简单的LL\*解析库
- types是插件和插件网页共享的类型和协议
- utils是插件自用的工具（是历史遗留问题）
- webview是插件的网页pkg。

请分析上述pkg的情况，整理文档。文档整理规则如下：

1. 在项目根目录建立docs目录，所有文档都在其中。
2. docs目录下，为每个pkg建立一个同名目录。目录里面，输出文档，分别为：
   - models/：存放产品定义。描述该包对用户（最终用户或其他包）提供的能力和功能的抽象。
   - specs/：存放代码风格和约束（编码规范、命名约定等）。不包含接口的具体信息——如果包有明确的"对外接口"概念，直接引导查看源代码。
   - tech/：存放技术架构。代码和技术层面的信息，如模块架构、依赖关系、技术选型等。
3. 每个子目录通常放置一个README.md。如果文档长度过长或存在明显的独立内容，可抽出单独文件，使用abc-def的kebab-case形式命名（README.md除外，以符合GitHub规则）。
4. docs目录下，建立extra目录。按主题（而非关联的pkg组合）组织跨包内容。仅存放没有明确归属的共享内容——若某内容明确归属于某个包（如API归属于提供它的包），则放在该包的文档中。
5. docs目录下，建立README.md，作为整个文档体系的导航索引，列出所有pkg和对应文档的链接，并记录上述文档结构要求。

关键约束：

1. 不要重复自身。不同文档间直接使用markdown相对路径链接进行引用。
2. 本次任务期间，不要提问。将所有待定内容记录到项目根目录的QUESTION.md中，等待我下次处理。
3. 不要修改代码。

历史遗留问题说明：

当前项目存在若干历史遗留问题，包括包划分不合理、模块功能归属混乱、代码风格不稳定等。整理文档时：

- 若发现代码风格冲突，以项目中最常见的规则为准来编写文档。
- 将发现的问题记录到项目根目录的TODO.md中，留待后续处理。
