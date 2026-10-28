# Maa Tools — 产品定义

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 包与使用者

`@nekosu/maa-tools` 为 Maa pipeline 开发者提供命令行检查和识别测试，也可用于仓库的自动检查。实际版本见包的 `package.json`，或执行 `maa-tools --version`。

## Pipeline 检查

```bash
npx @nekosu/maa-tools check [config-path]
```

加载 interface bundle，遍历控制器（controller）与资源（resource）组合；最终有序资源路径相同的组合只检查一次。每组使用隔离的 bundle 和 MaaFramework Resource，并发运行 [pipeline-manager](../../maa-pipeline-manager/models/) 诊断与原生资源加载校验，最后按发现顺序输出结果。

`check.job` 为大于等于 1 的整数，限制并发资源组数；默认是 CPU 可用并行度与 4 中的较小值。设置为 1 关闭并发，但仍合并等价路径组合。`check.override` 可调整诊断严重级别：

```ts
const config: FullConfig = {
  // ...
  check: {
    job: 4,
    override: {
      'dynamic-image': 'ignore'
    }
  }
}
```

检查支持 `stdio` 终端输出、`github` 工作流注解和 `json` 机器结果三种 mode。

## 识别测试

```bash
npx @nekosu/maa-tools test [config-path]
npx @nekosu/maa-tools test [config-path] --list
npx @nekosu/maa-tools test [config-path] --list --json
npx @nekosu/maa-tools test [config-path] --json --file tests/example/test_example.json --case 0
npx @nekosu/maa-tools test [config-path] --jsonl --file tests/example/test_example.json --case 0
```

测试的定义来自配置中的 `test.cases`，可以是数组或异步函数。收集和运行都加载该配置并展开用例；收集不初始化 MaaFramework、不运行识别，也不以某个固定目录扫描代替实际配置。

### 读取文件与保留来源

`loadTestCases(file)` 和 `loadAllTestCases(folder, pattern)` 共用读取、JSON 解析与结构校验。测试文件允许注释，不允许尾逗号。读取时会记录文件元数据、字符范围，并给每条用例填：

```ts
origin: {
  file: '/repo/tests/example/test_example.json',
  case: 0
}
```

`file` 为规范化绝对路径，`case` 为源文件 `cases` 数组下标，从 0 开始。loader 展开控制器或资源时要保留用例的 `origin`，复制时可保留 `...testCase`。显示组名、截图名、期望节点和识别框都不用于猜来源。

收集只列实际进入展开结果的有效来源与原始下标；有效文件或用例被配置主动排除后，不再因“曾经读取过”而出现在清单中。读取失败的文件保留错误条目，正常文件仍可收集和运行。

没有来源的程序生成组可以通过全量库调用运行，结果放在 `groups` 中；它不能按源码文件精确选择。收集会报告 `collection-source-missing` 并保留已识别的文件，不伪造完整清单。

### 选择范围

| 参数                  | 行为                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------- |
| `--file <path>`       | 可重复；按来源绝对路径精确选择。相对路径以命令调用目录为准，不受配置 `cwd` 改写         |
| `--case <n>`          | 从 0 起的原始下标，可重复；必须配单个文件。要求完整的非负十进制安全整数，越界报参数错误 |
| `--controller <name>` | 可重复，按组配置的控制器原值选择                                                        |
| `--resource <name>`   | 可重复，按组配置的资源原值选择                                                          |

过滤条件取交集。没有匹配为 `empty`，错误代码为 `no-tests-matched`，不初始化 MaaFramework。用例被 loader 排除后，显式请求它的下标也不会让它重新参与运行；结果会说明没有匹配。

**选择用例不改变识别断言。** 每组完整待检查节点在过滤前固定。选一条截图，仍检查同组所有节点：该条 `hits` 写出的节点期望命中，没写出的节点期望不命中。需要的识别结果缺失时不能默认通过。

### 收集输出

`test --list` 默认显示人类可读列表：文件路径、原始下标（从 0 开始）、用例名称或截图、文件错误，以及末尾总数或空集提示。配置与加载日志仍写到 stderr，列表写到 stdout。

添加 `--json` 后，`test --list --json` 返回同一收集结果的一份完整 JSON 文档。两种输出都只加载配置和用例，不初始化 MaaFramework，也不运行识别；收集不会输出逐条进度流。成功清单示例：

```json
{
  "schemaVersion": 1,
  "files": [
    {
      "file": "/repo/tests/example/test_example.json",
      "name": "示例",
      "controllers": ["ControllerA"],
      "resources": ["ResourceA"],
      "cases": [
        {
          "index": 0,
          "name": null,
          "image": "example.png",
          "hits": ["NodeA"],
          "start": 120,
          "end": 260
        }
      ]
    }
  ]
}
```

源码范围 `start`/`end` 从 0 开始，end 不包含在范围内。`index` 保留原始下标，返回的用例不必连续。`name` 没写时为 null；节点名 `hits` 是用于显示的去重字符串列表。`controllers` 和 `resources` 保留源文件声明值，只供显示，不能据此补出配置没有展开的运行平台。

坏文件以 `file`、`error` 和空数组字段保留。顶层收集错误还会带 `errorCode`、`reason`，命令行错误结果同时提供 `status: 'error'`、`groups` 和 `durationMs` 等错误信息；已识别的文件仍可保留。单个坏文件不会把整个清单变成无法解析的输出。

### 运行输出

`--json` 返回一份完整 `TestRunResult`；`--jsonl` 最后 `run-result` 的 `result` 也是同一结构：

| 顶层字段              | 含义                                                   |
| --------------------- | ------------------------------------------------------ |
| `schemaVersion`       | 当前为 1，调用方应检查                                 |
| `status`              | `passed`、`failed`、`error`、`empty`                   |
| `files`               | 框架汇总的逐文件、逐用例与逐平台结果                   |
| `groups`              | 按实际配置分组的原始结果，也支持无文件来源的全量库调用 |
| `durationMs`          | 本次运行实际经过的时间                                 |
| `errorCode`、`reason` | 可选的错误代码与说明，不要求调用方解析英文日志         |

文件结果包含文件元数据、`selectedCases`、`verdict`、可选 `reason` 和 `cases`。`selectedCases` 是本次计划运行的原始下标，`cases` 必须完整覆盖它；没有运行结果的计划用例保留明确错误，不能省略后让调用方猜通过。

文件下每条用例包含源码元数据、`verdict`、`durationMs`、可选 `reason`，以及 `platforms`。平台项包含 `controller`、`resource` 和实际 `result`，其中给出单个 `origin`、`imagePath`、`checks` 和识别时间。已解析的图片路径为绝对路径；尚未执行的 error 占位结果可以用空字符串表示还没有实际路径。平台来自配置实际展开的组，不能从源文件声明中的所有控制器和资源组合补造。

组结果中的 `controller`、`resource` 是组配置的原值，不是截图目录别名；组名只用于显示。识别检查明细记录期望命中或不命中、可选期望框、实际识别结果、是否通过和失败原因。

### 判定

- 单平台用例：检查决定 pass/fail，应返回却缺失节点结果也为 fail；缺图为 skipped；没有待检查节点或计划未能执行为 error。没有结果不当成未命中，识别无明细会报错。用例设置了期望框时，识别必须返回实际框且完整落在期望框内；未设置期望框则不检查框。
- 跨平台用例：fail 优先，其次 error；没有失败但有缺图平台时为 skipped，其余为 pass。
- 文件：有用例失败为 fail，其次 error；至少有一个平台完成有效检查、其余仅缺图跳过时可 pass；没有有效检查为 error。
- 整批：error 优先于 failed，再是 passed；没有匹配用例为 empty。无文件来源的全量调用按实际组结果汇总，不能因 `files` 为空就判 empty。

例如 A 平台有效检查通过、B 平台缺图：该用例汇总为 skipped，文件可以通过，但必须列明 B 未验证。所有聚合用例均为 skipped 不等于所有平台都没有验证；调用方直接使用框架给出的文件 verdict。所有平台均缺图，或没有有效检查，则不能返回 passed；纯缺图和没有节点可检查时也无需初始化 MaaFramework。

### 并行与耗时

`test.job` 限制每个资源路径组的 worker 数，为大于等于 1 的整数；默认是逻辑 CPU 数除以 4 后向下取整，最少 1。相同有序资源路径的组复用 workerpool，不同路径顺序分别处理。

同组使用规范化绝对截图路径复用识别任务。同图对应多个所选用例时，真实识别时间在这些用例间分摊，最后一条取余额避免累计偏差。组的 `durationMs` 等于用例时间之和；文件时间为对应各平台用例时间之和。并行任务的时间求和可能大于本次运行实际经过的时间。

### 机器输出与错误

`--list` 选择收集操作，`--json` 选择输出格式，可一起使用：

| 命令                 | 输出                                                 |
| -------------------- | ---------------------------------------------------- |
| `test`               | 默认文本运行结果                                     |
| `test --json`        | 一份完整运行 JSON                                    |
| `test --jsonl`       | 逐行 JSON 进度，最后唯一一条 `run-result` 含完整报告 |
| `test --list`        | 人类可读收集列表                                     |
| `test --list --json` | 一份完整 JSON 收集清单                               |

`--json` 与 `--jsonl` 互斥；`--list` 不支持 `--jsonl` 或 `--case`。收集清单不是进度流。

所有收集及 JSON 输出都在配置加载前把 JavaScript 日志转到 stderr。单独 `--list` 的配置或参数错误只作文字说明，`--list --json` 返回完整错误 JSON。运行错误使用所选格式，含 `--jsonl` 的非法组合也以 `run-result` 错误报告结束。机器调用方检查格式、范围与完整性，不解析人类日志。

`--version` 不加载配置，输出普通版本字符串，不是 JSON。库调用直接使用返回值；不要依赖终端颜色或日志文案来判断结果。

### 即时开始与完成

`test --jsonl` 通过标准输出逐行返回进度，每行一个紧凑 JSON 并以换行结束；日志写到 stderr。三类进度之后，最后唯一一条 `{schemaVersion: 1, type: 'run-result', result: TestRunResult}` 包含完整报告。终端与编辑器都可以读取同一输出流；只需要最终报告时使用 `test --json`。

框架的 `TestRunOptions.onEvent` 可接收以下 `TestRunEvent`，每条事件都带 `schemaVersion: 1`：

| type           | 内容与发出时机                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `case-started` | `origin`；首次提交该原始用例相关识别任务时发一次，跨平台不重复开始                                       |
| `case-result`  | `origin`、`result`；该来源在本次实际计划中的全部平台完成后，返回只含这一文件、这一原始下标的完整结果快照 |
| `file-result`  | `file`、`result`；文件全部所选用例有确定结果后，返回只含该文件本次选择范围的完整快照                     |

文件与用例仍用绝对来源路径和原始下标定位。每张图的全部节点块完成后就判定对应用例；同图复用只识别一次，但各条用例分别检查自己的期望。第一个平台通过不代表整条用例完成，必须等实际计划中的其余平台也有结果；不从源文件声明补造平台。

已知文件计划中的缺图、无节点、坏文件和无匹配条目也可直接得到完成结果，不伪造识别开始。尚未得到测试计划的配置或参数错误由最终错误 JSON 说明。

事件快照复用正式报告的汇总逻辑，所带 groups 也限定到对应范围。接收方检查来源、范围与快照完整性；最后 `run-result.result` 补全未报告项，并核对已完成事实。快照只对应当时及其范围，不要求其整批状态或经过时间等于最终整批值。

标准输出按行解析，不能把一次读取当成一个 JSON；需要处理中文、Windows 换行（CRLF）、多行同次到达和大行。未知记录、重复最后报告、报告之后还有记录或完整畸形行都报协议错误。正常结束没有完整 `run-result` 也不能算通过；取消或信号终止时，未完成末行不覆盖此前已校验的完成事实。

`onEvent` 可以返回 void 或 Promise，框架按事件顺序等待。回调抛错或拒绝时，框架记录一次传输错误并停发后续事件，识别及最终判定继续；因此调用方仍须读取最终结果，不能以缺少事件判断测试失败。

### 库调用

- `runTestDetailed(cfg, options?)` 返回完整 `TestRunResult`，不写错误结果文件。
- `runTest(cfg, options?)` 使用同一套执行与判定，仅在 `status === 'passed'` 时返回 true；failed/error 时把同一完整结果写到 `test.errorDetailsPath`，默认 `maatoolsErrorDetails.json`。
- `collectTests(cfg, files?, options?)` 使用配置收集文件与用例，不初始化 MaaFramework。

内部的文件读取、选择、判定和报告模块分工见 [技术架构](../tech/README.md)。内部辅助函数不因需要单元测试就必须作为包的公共入口。

## 其他入口

`npx @nekosu/maa-tools init` 生成 `maatools.config.mts`。配置通过 jiti 加载 TypeScript，支持 IDE 类型检查与补全。

`@nekosu/maa-tools/pm` 转导出 pipeline-manager API，供自定义识别或动作的 parser 配置使用。

maa-tools 不依赖 VS Code。编辑器调用它的收集和运行接口，负责显示与交互，不另写识别或汇总规则。

## MaaFramework 日志目录

`check` 和 `test` 都把框架日志放在独立目录，避免框架日志清理影响仓库图片，见 [TODO-23](../../TODO.md)。

- `check` 默认使用 `<cwd>/debug`，可由 `maaLogDir` 覆盖。
- `test` 每轮创建 `maa-tools-run-<n>`，默认在 `<cwd>/debug` 下；配置了 `maaLogDir` 就在其下创建。worker 使用各自子目录，避免互相覆盖。
- `test.maaLogKeep` 默认保留最近 10 个**已结束**轮次，至少 1 个；活动轮次不计入数量，也不会被另一轮清理。
- 运行结束后在 worker 停止后释放活动标记；正常进程退出也会释放。进程被终止或崩溃留下的标记，在后续创建轮次时按进程是否存活回收。
