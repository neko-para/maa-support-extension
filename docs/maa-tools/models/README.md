# Maa Tools — 产品定义

> ⚠️ 本文档由 AI 生成，主要用于辅助 AI 理解项目。内容可能与实际代码不同步，请注意甄别。

## 包与使用者

`@nekosu/maa-tools` 为 Maa pipeline 开发者提供命令行检查和识别测试，也可用于仓库的自动检查。实际版本见包的 `package.json`，或执行 `maa-tools --version`。配套 1.2.0 当前是待发布代码版本，不能据此认为 npm 已提供该版本；SDK 与节点测试插件的配套 PR 须共同合并并发版。

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

### 包版本与 JSON 兼容

收集清单、运行报告和逐行记录的兼容性随 `@nekosu/maa-tools` 包版本管理。配套节点测试插件接受稳定版 `>=1.2.0 <2.0.0`，允许 `v` 前缀和构建元数据，不接受预发布版、未知或格式无效的版本。新主版本须等插件明确支持后才接收。

1.x 内可以增加旧调用方可忽略的可选字段。改名、删除必需字段、改变字段类型或结论语义，以及增加旧插件必须处理的新记录 `type` 或枚举值，都属于不兼容变更，须发布新主版本。调用方仍须检查实际数据的必需结构、合法 `type`、来源、选择覆盖及进度与最终结果一致性。包版本声明不能证明命令可以正常启动。

### 读取文件与保留来源

`loadTestCases(file)` 和 `loadAllTestCases(folder, pattern)` 共用读取、JSON 解析与结构校验。测试文件允许注释，不允许尾逗号。读取时会记录文件元数据、字符范围，并给每条用例填：

```ts
origin: {
  file: '/repo/tests/example/test_example.json',
  case: 0
}
```

`file` 为实际测试 JSON 文件的规范化绝对路径，`case` 为源文件 `cases` 数组下标，从 0 开始，须为非负安全整数。普通测试 JSON 仍只写 `name`、`image`、`hits` 等字段，不用手写 origin；上面的来源由文件加载函数自动补齐。loader 展开控制器或资源时要保留用例的 `origin`，复制时可保留 `...testCase`。动态生成的展开对象也须关联实际文件和原始下标。显示组名、截图名、期望节点和识别框都不用于猜来源。

只支持文件测试，展开后的 `TestCases.cases.origin` 与 `TestCaseRunResult.origin` 在类型和运行时都必填。缺少、格式无效或无法对应实际文件元数据与原始下标的 origin，在加载计划阶段报 `test-source-invalid`，不能进入识别。

收集只列实际进入展开结果的有效来源与原始下标；有效文件或用例被配置主动排除后，不再因“曾经读取过”而出现在清单中。读取失败的文件保留错误条目，正常文件仍可收集和运行。

### 选择范围

| 参数                  | 行为                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------- |
| `--file <path>`       | 可重复；按来源绝对路径精确选择。相对路径以命令调用目录为准，不受配置 `cwd` 改写         |
| `--case <n>`          | 从 0 起的原始下标，可重复；必须配单个文件。要求完整的非负十进制安全整数，越界报参数错误 |
| `--controller <name>` | 可重复，按组配置的控制器原值选择                                                        |
| `--resource <name>`   | 可重复，按组配置的资源原值选择                                                          |

来源文件路径在 Windows 上规范化后按不区分大小写的方式匹配和去重；其他系统区分大小写。返回和显示路径保留原有大小写。

过滤条件取交集。没有匹配为 `empty`，错误代码为 `no-tests-matched`，不初始化 MaaFramework。用例被 loader 排除后，显式请求它的下标也不会让它重新参与运行；结果会说明没有匹配。

**选择用例不改变识别断言。** 每组完整待检查节点在过滤前固定。选一条截图，仍检查同组所有节点：该条 `hits` 写出的节点期望命中，没写出的节点期望不命中。需要的识别结果缺失时不能默认通过。

### 收集输出

`test --list` 默认显示人类可读列表：文件路径、原始下标（从 0 开始）、用例名称或截图、文件错误，以及末尾总数或空集提示。配置与加载日志仍写到 stderr，列表写到 stdout。

添加 `--json` 后，`test --list --json` 返回同一收集结果的一份完整 JSON 文档。两种输出都只加载配置和用例，不初始化 MaaFramework，也不运行识别；收集不会输出逐条进度流。成功清单示例：

```json
{
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

坏文件以 `file`、`error` 和空数组字段保留。顶层收集错误还会带 `errorCode`、`reason`，命令行错误结果同时提供 `status: 'error'` 和 `durationMs` 等错误信息；已识别的文件仍可保留。单个坏文件不会把整个清单变成无法解析的输出。

### 运行输出

#### 默认终端输出

不带 `--json` 或 `--jsonl` 时，`maa-tools test` 默认按文本显示运行结果。下面的示例省略配置加载、框架准备和原生日志，只展示 maa-tools 的测试结果行。

文本按实际运行组显示：组名取展开后配置中的 `configs.name`，未设置时使用 `controller:resource`。例如两个组通过时：

```text
ControllerA:ResourceA
ControllerB:ResourceA
```

终端支持颜色时，组名用以下颜色表示。通过的用例不会逐条打印 `passed`，当前也没有通过、失败用例总数的汇总行。

| 组名颜色 | 含义                                                                      |
| -------- | ------------------------------------------------------------------------- |
| 绿色     | 组结论为 pass；组内可以包含缺图跳过的用例，不能据此认为每条用例都完成验证 |
| 黄色     | 组内用例全部跳过，通常因为截图都不存在                                    |
| 红色     | 组内有失败检查或执行错误                                                  |

失败检查在组名下缩进显示图片名、节点名和原因。例如：

```text
ControllerA:ResourceA
  example.png Entry should hit but missed
  example.png Other should missed but hit
  example.png BoxNode box mismatch. Expect [100,100,200,200], hit [90,90,20,20]
```

常见提示对应以下含义；其中英文片段沿用当前终端实际文案：

| 输出片段                            | 含义                                                 |
| ----------------------------------- | ---------------------------------------------------- |
| `should hit but missed`             | 预期命中该节点，实际未命中                           |
| `should missed but hit`             | 预期不命中该节点，实际却命中                         |
| `box mismatch. Expect ..., hit ...` | 实际识别框不符合期望范围；实际框必须完整落在期望框内 |
| `missing detail.`                   | 没有返回该节点的识别明细                             |
| `no reco result.`                   | 该图片、节点没有返回识别结果，不能把它当作未命中     |

缺图会先打印一行提示；如果该组全部跳过，还会打印黄色组名：

```text
ControllerA:ResourceA missing.png not exists, ignored
ControllerA:ResourceA
```

`ignored` 只表示这张图跳过识别，不表示验证通过。所有平台都缺图时，整批不能通过；部分平台有有效验证时，文件仍可能通过，具体规则见下方判定说明。

识别进度写到 stderr，并用回车在同一行更新，例如：

```text
100.00% 12 / 12
```

计数表示已处理、总共计划处理的“图片—节点”识别项，不是用例数，也不是通过数；同组截图复用后只计实际安排的识别任务。100% 表示这些识别项处理完毕，断言仍可能失败。没有实际识别任务时不会显示这行进度。整批错误原因和异常信息也写到 stderr。

配置 `mode: 'github'` 时，缺图提示使用 GitHub Actions 的 warning 注解；在 GitHub Actions 中未设置 mode 时会自动采用此模式。需要结构化结果时，显式使用 `--json` 或 `--jsonl`。

#### 退出码与错误结果文件

执行测试时，退出码含义如下；仅收集的 `--list` 不适用“空运行返回 1”这一条。

| 退出码 | 含义                                                                        |
| ------ | --------------------------------------------------------------------------- |
| `0`    | 整批状态为 passed                                                           |
| `1`    | 整批 failed、error 或 empty，或者配置加载、选择、执行等阶段失败             |
| `2`    | CLI 参数解析失败，例如未知参数、缺少参数值、`--case` 格式错误或互斥选项组合 |

格式合法但超出文件用例范围的 `--case` 属于选择失败，返回 `1`。

普通文本运行进入 `runTest()` 后，如果有 `test` 配置且最终状态为 failed 或 error，会把完整 `TestRunResult` 写到 `test.errorDetailsPath`，默认文件名为 `maatoolsErrorDetails.json`。相对路径以配置的 `cwd` 为基准，未设置 `cwd` 时使用当前工作目录；父目录会自动创建。报告包含整批状态、文件结果、检查明细、原因和耗时，不只是失败检查数组。

passed 和 empty 不写错误报告，也不会删除之前留下的错误文件。参数解析、配置加载或进入 `runTest()` 前的选择错误不保证生成这个文件。自动化应根据本次退出码或机器报告判断结果，不能只检查旧错误文件是否存在。

`--json` 和 `--jsonl` 直接返回完整机器报告，不写上述错误结果文件；报告格式如下。

#### JSON 报告

`--json` 返回一份完整 `TestRunResult`；`--jsonl` 最后 `run-result` 的 `result` 也是同一结构：

| 顶层字段              | 含义                                           |
| --------------------- | ---------------------------------------------- |
| `status`              | `passed`、`failed`、`error`、`empty`           |
| `files`               | 框架汇总的逐文件、逐用例与逐平台结果           |
| `durationMs`          | 本次运行实际经过的时间                         |
| `errorCode`、`reason` | 可选的错误代码与说明，不要求调用方解析英文日志 |

公开报告只有上述字段，不含 `groups` 或 `schemaVersion`。`files` 是全部结果的唯一公开明细；内部测试组仍用于展开、固定节点、调度和并行判定，文本输出继续按组显示。

文件结果包含元数据、`selectedCases`、`verdict`（pass/fail/error/skipped）、可选 `reason` 和 `cases`。`selectedCases` 是本次计划下标，`cases` 必须完整覆盖它。过滤后本次 cases 为空且无文件错误时，文件为 `skipped`，reason 为 `no-cases-selected`，两数组均为空；有计划却缺结果不能改成跳过。

文件下每条用例包含源码元数据、`verdict`、`durationMs`、可选 `reason`，以及 `platforms`。平台项包含 `controller`、`resource` 和实际 `result`，其中给出单个 `origin`、`imagePath`、`checks` 和识别时间。已解析的图片路径为绝对路径；尚未执行的 error 占位结果可以用空字符串表示还没有实际路径。平台来自配置实际展开的组，不能从源文件声明中的所有控制器和资源组合补造。

平台项中的 `controller`、`resource` 是组配置的原值，不是截图目录别名。识别检查明细记录期望命中或不命中、可选期望框、实际识别结果、是否通过和失败原因。

每个实际平台用例结果只在 `files[].cases[].platforms[].result` 中出现一次，且必须带有效 origin，与所属文件和用例原始下标一致。

下面用一个文件、一条用例、一个运行组的成功结果说明两种输出。假设在 `/repo` 下执行，加载器把用例展开为 `ControllerA` / `ResourceA`，节点 `Entry` 命中。路径、源码偏移、识别明细与耗时为说明用值；示例保留完整结果结构。

执行单报告模式：

```bash
npx @nekosu/maa-tools test --json --file tests/example/test_example.json --case 0
```

stdout 只返回下面这一份 JSON，退出码为 `0`；这里为方便阅读加了缩进，实际 CLI 使用紧凑 JSON。配置加载、测试日志写到 stderr。

```json
{
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
          "hits": ["Entry"],
          "start": 120,
          "end": 260,
          "verdict": "pass",
          "durationMs": 12,
          "platforms": [
            {
              "controller": "ControllerA",
              "resource": "ResourceA",
              "result": {
                "image": "example.png",
                "imagePath": "/repo/test-images/ControllerA/ResourceA/example.png",
                "origin": {
                  "file": "/repo/tests/example/test_example.json",
                  "case": 0
                },
                "verdict": "pass",
                "checks": [
                  {
                    "node": "Entry",
                    "expected": "hit",
                    "hit": true,
                    "detail": {
                      "name": "Entry",
                      "algorithm": "DirectHit",
                      "hit": true,
                      "box": [0, 0, 1280, 720],
                      "detail": null,
                      "raw": {},
                      "draws": []
                    },
                    "ok": true
                  }
                ],
                "durationMs": 12
              }
            }
          ]
        }
      ],
      "selectedCases": [0],
      "verdict": "pass"
    }
  ],
  "durationMs": 50,
  "status": "passed"
}
```

`files[0].cases[0].platforms[0].result` 是这次平台验证的唯一公开明细。`origin.case: 0`、`index: 0`、`selectedCases: [0]` 始终对应原始用例下标。用例和文件的识别时间都是 `12` 毫秒；顶层 `50` 毫秒是整次运行经过的时间。`detail` 原样保留框架识别明细，算法不同，内部字段也会不同；示例中 `raw: {}` 是图像内存数据转成 JSON 后的表现，截图文件位置应读取 `imagePath`。

#### JSONL 逐行输出示例

对同一条用例改用逐行模式：

```bash
npx @nekosu/maa-tools test --jsonl --file tests/example/test_example.json --case 0
```

stdout 的完整输出如下。每行都是一个独立 JSON 对象，行间没有逗号，也没有外层数组；下面四行保留实际的逐行形式，复制后可以按行调用 `JSON.parse()`。

<!-- prettier-ignore -->
```jsonl
{"type":"case-started","origin":{"file":"/repo/tests/example/test_example.json","case":0}}
{"type":"case-result","origin":{"file":"/repo/tests/example/test_example.json","case":0},"result":{"files":[{"file":"/repo/tests/example/test_example.json","name":"示例","controllers":["ControllerA"],"resources":["ResourceA"],"cases":[{"index":0,"name":null,"image":"example.png","hits":["Entry"],"start":120,"end":260,"verdict":"pass","durationMs":12,"platforms":[{"controller":"ControllerA","resource":"ResourceA","result":{"image":"example.png","imagePath":"/repo/test-images/ControllerA/ResourceA/example.png","origin":{"file":"/repo/tests/example/test_example.json","case":0},"verdict":"pass","checks":[{"node":"Entry","expected":"hit","hit":true,"detail":{"name":"Entry","algorithm":"DirectHit","hit":true,"box":[0,0,1280,720],"detail":null,"raw":{},"draws":[]},"ok":true}],"durationMs":12}}]}],"selectedCases":[0],"verdict":"pass"}],"durationMs":35,"status":"passed"}}
{"type":"file-result","file":"/repo/tests/example/test_example.json","result":{"files":[{"file":"/repo/tests/example/test_example.json","name":"示例","controllers":["ControllerA"],"resources":["ResourceA"],"cases":[{"index":0,"name":null,"image":"example.png","hits":["Entry"],"start":120,"end":260,"verdict":"pass","durationMs":12,"platforms":[{"controller":"ControllerA","resource":"ResourceA","result":{"image":"example.png","imagePath":"/repo/test-images/ControllerA/ResourceA/example.png","origin":{"file":"/repo/tests/example/test_example.json","case":0},"verdict":"pass","checks":[{"node":"Entry","expected":"hit","hit":true,"detail":{"name":"Entry","algorithm":"DirectHit","hit":true,"box":[0,0,1280,720],"detail":null,"raw":{},"draws":[]},"ok":true}],"durationMs":12}}]}],"selectedCases":[0],"verdict":"pass"}],"durationMs":36,"status":"passed"}}
{"type":"run-result","result":{"files":[{"file":"/repo/tests/example/test_example.json","name":"示例","controllers":["ControllerA"],"resources":["ResourceA"],"cases":[{"index":0,"name":null,"image":"example.png","hits":["Entry"],"start":120,"end":260,"verdict":"pass","durationMs":12,"platforms":[{"controller":"ControllerA","resource":"ResourceA","result":{"image":"example.png","imagePath":"/repo/test-images/ControllerA/ResourceA/example.png","origin":{"file":"/repo/tests/example/test_example.json","case":0},"verdict":"pass","checks":[{"node":"Entry","expected":"hit","hit":true,"detail":{"name":"Entry","algorithm":"DirectHit","hit":true,"box":[0,0,1280,720],"detail":null,"raw":{},"draws":[]},"ok":true}],"durationMs":12}}]}],"selectedCases":[0],"verdict":"pass"}],"durationMs":50,"status":"passed"}}
```

四条记录分别表示用例开始、用例完成、文件完成和整批结束。这个例子只运行一个文件的一条用例，所以三个完成报告的范围相同，所带的完整结构也相同；前两个快照分别记录当时经过的 `35`、`36` 毫秒，最后报告记录整次运行的 `50` 毫秒。最后一条 `run-result.result` 与上面 `--json` 示例的完整报告一致，退出码同样为 `0`。各类记录的时机、取消和最后报告核对规则见[即时开始与完成](#即时开始与完成)。

如果参数解析失败，还没有形成测试计划，就只有一条最终错误记录。例如：

```bash
npx @nekosu/maa-tools test --jsonl --case bad
```

<!-- prettier-ignore -->
```jsonl
{"type":"run-result","result":{"files":[],"durationMs":1,"status":"error","errorCode":"invalid-cli-arguments","reason":"--case 需要一个非负安全整数下标"}}
```

此时退出码为 `2`，错误原因也写到 stderr，`files` 为空，不会伪造用例开始或用例、文件完成事件。换成 `--json --case bad` 时，stdout 直接返回上面 `result` 内的错误对象，不带外层 `type` 和 `result`。

配置展开后缺少或带有无效 origin 时，在加载计划阶段返回同样结构的 `test-source-invalid` 错误报告，退出码为 `1`，没有开始事件；正常文件由加载函数读取时自动产生 origin。

### 判定

- 单平台用例：检查决定 pass/fail，应返回却缺失节点结果也为 fail；缺图为 skipped；没有待检查节点或计划未能执行为 error。没有结果不当成未命中，识别无明细会报错。用例设置了期望框时，识别必须返回实际框且完整落在期望框内；未设置期望框则不检查框。
- 跨平台用例：fail 优先，其次 error；没有失败但有缺图平台时为 skipped，其余为 pass。
- 文件：有用例失败时为 fail，其次看文件 error 或用例 error；无文件错误且过滤后本次没有用例时为 skipped。至少一个平台完成有效检查、其余仅缺图时可 pass；坏文件、缺结果或全缺图无验证仍为 error。
- 整批：error 优先于 failed，再是 passed，文件错误仍使整批 error；过滤后的空文件不影响其他文件的真实通过或失败，全部过滤为空仍为 empty。

例如 A 平台有效检查通过、B 平台缺图：该用例汇总为 skipped，文件可以通过，但必须列明 B 未验证。所有聚合用例均为 skipped 不等于所有平台都没有验证；调用方直接使用框架给出的文件 verdict。所有平台均缺图，或没有有效检查，则不能返回 passed；纯缺图和没有节点可检查时也无需初始化 MaaFramework。

### 并行与耗时

`test.job` 限制每个资源路径组的 worker 数，为大于等于 1 的整数；默认是逻辑 CPU 数除以 4 后向下取整，最少 1。相同有序资源路径的组复用 workerpool，不同路径顺序分别处理。

同组使用规范化绝对截图路径复用识别任务。同图对应多个所选用例时，真实识别时间在这些用例间分摊，最后一条取余额避免累计偏差。内部组的识别时间等于用例时间之和，不作为公开报告字段；文件时间为对应各平台用例时间之和。并行任务的时间求和可能大于本次运行实际经过的时间。

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

所有收集及 JSON 输出都在配置加载前把 JavaScript 日志转到 stderr。单独 `--list` 的配置或参数错误只作文字说明，`--list --json` 返回完整错误 JSON。运行错误使用所选格式，含 `--jsonl` 的非法组合也以 `run-result` 错误报告结束。机器调用方检查必需结构、合法记录 `type`、来源、范围与完整性，不解析人类日志；参数或配置错误的机器输出也遵守同一规则。

编辑辅助解析和未知字段检查不能代替来源的结构、类型及身份校验。

`--version` 不加载配置，输出普通版本字符串，不是 JSON。库调用直接使用返回值；不要依赖终端颜色或日志文案来判断结果。

### 即时开始与完成

`test --jsonl` 通过标准输出逐行返回进度，每行一个紧凑 JSON 并以换行结束；日志写到 stderr。三类进度之后，最后唯一一条 `{type: 'run-result', result: TestRunResult}` 包含完整报告。终端与编辑器都可以读取同一输出流；只需要最终报告时使用 `test --json`。

框架的 `TestRunOptions.onEvent` 可接收以下 `TestRunEvent`，保留 `type` 区分事件：

| type           | 内容与发出时机                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `case-started` | `origin`；首次提交该原始用例相关识别任务时发一次，跨平台不重复开始                                       |
| `case-result`  | `origin`、`result`；该来源在本次实际计划中的全部平台完成后，返回只含这一文件、这一原始下标的完整结果快照 |
| `file-result`  | `file`、`result`；文件全部所选用例有确定结果后，返回只含该文件本次选择范围的完整快照                     |

文件与用例仍用绝对来源路径和原始下标定位。每张图的全部节点块完成后就判定对应用例；同图复用只识别一次，但各条用例分别检查自己的期望。第一个平台通过不代表整条用例完成，必须等实际计划中的其余平台也有结果；不从源文件声明补造平台。

已知文件计划中的缺图、无节点、坏文件和无匹配条目也可直接得到完成结果，不伪造识别开始。尚未得到测试计划的配置或参数错误由最终错误 JSON 说明。

事件快照复用正式报告的汇总逻辑，只含对应范围的 `files`。接收方检查必需结构、合法 `type`、来源、原始下标、请求覆盖、汇总与快照完整性；最后 `run-result.result` 补全未报告项，并核对已完成事实。快照只对应当时及其范围，不要求其整批状态或经过时间等于最终整批值。相同重复消息不重复发布，矛盾消息或最终不一致报协议错误，取消不能忽略此前完整记录中的错误。

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
