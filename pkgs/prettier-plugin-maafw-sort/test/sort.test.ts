import assert from "node:assert/strict";
import test from "node:test";
import * as prettier from "prettier";

import * as maafwSort from "../dist/index.mjs";

// 注意：本文件断言的是"乱序输入会被排序"，与 test/ 目录下已排序的 fixture
// （只能防过度处理）互补，共同覆盖漏处理与过度处理两个方向。
//
// 跑的是 dist 产物：`pnpm test` 经 pretest 重建 dist；直接 `node --test` 沿用
// 现有 dist（mutation 验证即利用这一点，改 dist 不改 src）。
//
// filepath 约定：prettier 的 API 调用不会像 CLI 那样规范化 filepath，裸文件名
// （如 "interface.json"）不会命中默认 pattern（pattern 期望路径含目录段）。
// 用例统一带 "proj/" 前缀以命中各 pattern，请保留该约定。

// 插件的 parse 是 async 函数，prettier.format 会因此返回 Promise
async function fmt(text: string, filepath: string): Promise<string> {
    return prettier.format(text, {
        parser: "json",
        plugins: [maafwSort],
        filepath,
        tabWidth: 4,
    });
}

async function fmtJson(value: unknown, filepath: string): Promise<Record<string, unknown>> {
    return JSON.parse(await fmt(JSON.stringify(value), filepath)) as Record<string, unknown>;
}

function keys(value: unknown): string[] {
    assert.ok(typeof value === "object" && value !== null);
    return Object.keys(value);
}

test("interface: root/entry orders follow protocol doc, arrays untouched", async () => {
    const out = await fmtJson(
        {
            task: [
                {
                    option: ["o1"],
                    pipeline_override: {T: {next: ["A"], desc: "d"}},
                    entry: "E",
                    controller: ["c"],
                    resource: ["r"],
                    description: "desc",
                    label: "L",
                    name: "n",
                },
            ],
            option: {
                o1: {
                    label: "L",
                    type: "select",
                    cases: [{pipeline_override: {C: {timeout: 1, desc: "d"}}, name: "c1"}],
                    default_case: "c1",
                },
            },
            controller: [{option: ["o1"], attach_resource_path: ["p"], type: "Adb", name: "c"}],
            resource: [{option: ["o1"], controller: ["c"], path: ["p"], name: "r", hash: "h"}],
            import: [
                "b.json",
                "a.json",
            ],
            name: "proj",
            agent: [{identifier: "i", child_args: ["--x"], child_exec: "node"}],
        },
        "proj/interface.json",
    );

    // 根序遵循协议文档：name → controller → resource → agent → task → option → import
    assert.deepEqual(keys(out), [
        "name",
        "controller",
        "resource",
        "agent",
        "task",
        "option",
        "import",
    ]);
    // import 数组顺序保留
    assert.deepEqual(out.import, [
        "b.json",
        "a.json",
    ]);

    const task = (out.task as Record<string, unknown>[])[0];
    assert.deepEqual(keys(task), [
        "name",
        "label",
        "entry",
        "description",
        "resource",
        "controller",
        "pipeline_override",
        "option",
    ]);

    const opt = (out.option as Record<string, Record<string, unknown>>).o1;
    assert.deepEqual(keys(opt), [
        "type",
        "label",
        "cases",
        "default_case",
    ]);
    const cs = (opt.cases as Record<string, unknown>[])[0];
    assert.deepEqual(keys(cs), [
        "name",
        "pipeline_override",
    ]);

    const ctrl = (out.controller as Record<string, unknown>[])[0];
    assert.deepEqual(keys(ctrl), [
        "name",
        "type",
        "attach_resource_path",
        "option",
    ]);
    const res = (out.resource as Record<string, unknown>[])[0];
    assert.deepEqual(keys(res), [
        "name",
        "path",
        "controller",
        "option",
        "hash",
    ]);
    const agent = (out.agent as Record<string, unknown>[])[0];
    assert.deepEqual(keys(agent), [
        "child_exec",
        "child_args",
        "identifier",
    ]);

    // pipeline_override 内部走 pipeline 排序
    const override = task.pipeline_override as Record<string, string[]>;
    assert.deepEqual(keys(override.T), [
        "desc",
        "next",
    ]);
});

test("interface: $-prefixed root field keeps original position", async () => {
    const top = await fmtJson({$schema: "./schema.json", task: [{entry: "E", name: "n"}]}, "proj/interface.json");
    assert.equal(keys(top)[0], "$schema");

    // keep 语义是按原始下标插回：输入序 option(0) $schema(1) task(2)，
    // 排序后 task/option 归位，$schema 仍落在两者之间的下标 1
    const mid = await fmtJson(
        {option: {o: {type: "select"}}, $schema: "./schema.json", task: [{entry: "E", name: "n"}]},
        "proj/interface.json",
    );
    assert.deepEqual(keys(mid), [
        "task",
        "$schema",
        "option",
    ]);
});

test("detect: option-only fragment is detected without pattern", async () => {
    const out = await fmtJson(
        {
            option: {
                myOpt: {
                    label: "L",
                    type: "select",
                    cases: [{pipeline_override: {T: {next: ["A"], desc: "d"}}, name: "c"}],
                },
            },
        },
        "proj/frag.opts.json",
    );
    const opt = (out.option as Record<string, Record<string, unknown>>).myOpt;
    assert.deepEqual(keys(opt), [
        "type",
        "label",
        "cases",
    ]);
    const override = (opt.cases as Record<string, unknown>[])[0].pipeline_override as Record<string, string>;
    assert.deepEqual(keys(override.T), [
        "desc",
        "next",
    ]);
});

test("detect: hotkey-only option fragment is detected", async () => {
    const out = await fmtJson(
        {
            option: {
                hk: {
                    label: "L",
                    type: "hotkey",
                    hotkeys: [{default: "69", description: "d", label: "Skill", name: "skill"}],
                },
            },
        },
        "proj/frag.hk.json",
    );
    const opt = (out.option as Record<string, Record<string, unknown>>).hk;
    assert.deepEqual(keys(opt), [
        "type",
        "label",
        "hotkeys",
    ]);
    assert.deepEqual(keys((opt.hotkeys as Record<string, unknown>[])[0]), [
        "name",
        "label",
        "description",
        "default",
    ]);
});

test("pattern: weak-section interface file sorted via pattern, not detection", async () => {
    // 仅 group/global_option 不会触发内容探测，只有 pattern 路由能排它
    const out = await fmtJson(
        {global_option: ["x"], name: "p", group: [{icon: "i", label: "L", name: "g"}]},
        "proj/interface.json",
    );
    assert.deepEqual(keys(out), [
        "name",
        "group",
        "global_option",
    ]);
});

test("detect: non-maa json stays untouched", async () => {
    const cases: Record<string, unknown>[] = [
        {
            zzz: 1,
            task: [
                "build",
                "test",
            ],
            aaa: 2,
        },
        {zzz: 1, task: [{name: "build"}], aaa: 2},
        {zzz: 1, task: [{name: {en: "x"}, entry: "e"}], aaa: 2},
        {zzz: 1, resource: [{name: "r", path: 5}], aaa: 2},
        {zzz: 1, task: [{name: "a", entry: 5}], aaa: 2},
        {zzz: 1, controller: [{name: "c", type: 5}], aaa: 2},
        {zzz: 1, preset: [{name: "p", task: "x"}], aaa: 2},
    ];
    for (const value of cases) {
        const expected = Object.keys(value);
        const out = await fmtJson(value, "proj/pkg.json");
        assert.deepEqual(keys(out), expected, JSON.stringify(value));
    }
});

test("fallback: malformed sections still get override sorting", async () => {
    const out = await fmtJson(
        {
            resource: [{name: "r", path: "p"}],
            task: {
                pipeline_override: {T: {next: ["A"], desc: "d"}},
                entry: "E",
                name: "n",
            },
            option: [{pipeline_override: {T: {next: ["A"], desc: "d"}}, name: "x"}],
        },
        "proj/frag.mixed.json",
    );

    const task = out.task as Record<string, unknown>;
    assert.deepEqual(keys(task), [
        "name",
        "entry",
        "pipeline_override",
    ]);
    assert.deepEqual(keys((task.pipeline_override as Record<string, string[]>)["T"]), [
        "desc",
        "next",
    ]);

    const optArr = out.option as Record<string, unknown>[];
    const override = optArr[0].pipeline_override as Record<string, string[]>;
    assert.deepEqual(keys(override.T), [
        "desc",
        "next",
    ]);
});

test("pipeline: normal task sorted, $-prefixed root field untouched", async () => {
    const out = await fmtJson(
        {
            $__mpe_code: {next: ["a"], desc: "mpe config"},
            T: {next: ["a"], desc: "d", recognition: "DirectHit", action: "Click"},
        },
        "proj/pipeline/x.json",
    );

    // $ 前缀 root field 内部保持原序（next 仍在 desc 前）
    const mpe = out.$__mpe_code as Record<string, unknown>;
    assert.deepEqual(keys(mpe), [
        "next",
        "desc",
    ]);

    const t = out.T as Record<string, unknown>;
    assert.deepEqual(keys(t), [
        "desc",
        "recognition",
        "action",
        "next",
    ]);
});

test("pretask/setting/group entry orders", async () => {
    const out = await fmtJson(
        {
            pretask: {
                option: ["o"],
                icon: "i",
                description: "d",
                label: "L",
                name: "p",
                args: ["--x"],
                exec: "node",
                controller: ["c"],
                resource: ["r"],
            },
            setting: [{default_expand: true, option: ["o"], icon: "i", description: "d", label: "L", name: "s"}],
            group: [{default_expand: false, icon: "i", description: "d", label: "L", name: "g"}],
        },
        "proj/interface.json",
    );
    assert.deepEqual(keys(out.pretask as Record<string, unknown>), [
        "resource",
        "controller",
        "exec",
        "args",
        "name",
        "label",
        "description",
        "icon",
        "option",
    ]);
    assert.deepEqual(keys((out.setting as Record<string, unknown>[])[0]), [
        "name",
        "label",
        "description",
        "icon",
        "option",
        "default_expand",
    ]);
    assert.deepEqual(keys((out.group as Record<string, unknown>[])[0]), [
        "name",
        "label",
        "description",
        "icon",
        "default_expand",
    ]);
});

test("locale: keys sorted by UTF-16 code unit order, arrays untouched", async () => {
    const out = await fmtJson(
        {
            "Option.B.x": {z: 1, a: 2},
            "$Task.Z.desc": "z",
            "Common.A": "c",
            "$Task.A.label": "a",
            arr: [
                "b",
                "a",
            ],
        },
        "proj/locales/zh_cn.json",
    );
    assert.deepEqual(keys(out), [
        "$Task.A.label",
        "$Task.Z.desc",
        "Common.A",
        "Option.B.x",
        "arr",
    ]);
    assert.deepEqual(keys(out["Option.B.x"]), [
        "a",
        "z",
    ]);
    assert.deepEqual(out.arr, [
        "b",
        "a",
    ]);
});

test("locale: non-matching path untouched", async () => {
    const out = await fmtJson({zz: 1, aa: 2}, "proj/data/x.json");
    assert.deepEqual(keys(out), [
        "zz",
        "aa",
    ]);
});

test("idempotency", async () => {
    const inputs: [value: unknown, filepath: string][] = [
        [
            {
                task: [{option: ["o"], pipeline_override: {T: {next: ["A"], desc: "d"}}, entry: "E", name: "n"}],
                option: {o: {type: "select", cases: [{name: "c", pipeline_override: {T: {timeout: 1, desc: "d"}}}]}},
            },
            "proj/interface.json",
        ],
        [
            {
                option: {
                    o: {
                        type: "input",
                        inputs: [{pattern_msg: "m", verify: "v", default: "1", name: "i", password: true}],
                    },
                },
            },
            "proj/f.json",
        ],
        [
            {zzz: 1, task: ["build"], aaa: 2},
            "proj/pkg.json",
        ],
        [
            {k2: "b", k1: "a"},
            "proj/locales/zh_cn.json",
        ],
        [
            {$__mpe_code: {next: ["a"], desc: "m"}, T: {next: ["a"], desc: "d"}},
            "proj/pipeline/x.json",
        ],
    ];
    for (const [
        value,
        filepath,
    ] of inputs) {
        const once = await fmt(JSON.stringify(value), filepath);
        const twice = await fmt(once, filepath);
        assert.equal(twice, once, filepath);
    }
});
