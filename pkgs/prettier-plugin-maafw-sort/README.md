# @nekosu/prettier-plugin-maafw-sort

Prettier plugin to sort keys of MaaFramework pipeline and interface json.

## Install

```shell
npm i -D @nekosu/prettier-plugin-maafw-sort
```

## Options

### maafwPipelinePatterns `string[]`

Regexs that match pipeline json path. Always use forward slash.

Default: `/pipeline/.*\.jsonc?`

### maafwInterfacePatterns `string[]`

Regexs that match interface json path. Always use forward slash.

Default: `/interface\.jsonc?`

### maafwLocalePatterns `string[]`

Regexs that match localization json path (translation map files, typically the ones referenced by interface `languages`; the plugin matches paths only and does not follow `languages` references). Always use forward slash.

All object keys in a matching file are sorted alphabetically (UTF-16 code unit order, locale-independent and deterministic across environments), recursively. Array orders are never touched.

The default matches any path containing `/locales/` (including e.g. webview or docs i18n directories); pass `[]` to disable.

Default: `/locales/.*\.jsonc?`

### maafwInterfaceDetect `boolean`

Sort json files that structurally look like a MaaFramework interface file even when no pattern matches. This covers fragment files pulled in via interface `import`, which may have arbitrary names.

Detection applies to every json/jsonc file regardless of `maafwInterfacePatterns` (the patterns only add explicit coverage); set this option to `false` to disable it entirely.

A file counts when its root object has a strong interface signal:

- a `task` / `controller` / `resource` / `preset` array with at least one entry that is an object with a string `name` plus the section marker (`task` → `entry`, `controller` → `type`, `resource` → `path`, `preset` → `task`), or
- an `option` object with at least one entry containing `cases` / `inputs` / `hotkeys` / `default_case` / `pipeline_override`.

Plain task lists like `"task": ["build", "test"]` do not trigger it. Fragments containing only `group` / `global_option` / `setting` are not detected on their own — cover those with `maafwInterfacePatterns`.

Only object keys are sorted; array orders (task list, cases, option refs, resource paths, import list, ...) are never touched.

Default: `true`

## Playing with other plugins

Use `patchPlugin` to merge another plugin that also provides json/jsonc parser.

```typescript
import * as multilineArrays from 'prettier-plugin-multiline-arrays'

import * as maafwSort from '@nekosu/prettier-plugin-maafw-sort'

export default {
  plugins: [maafwSort.patchPlugin(multilineArrays)]
}
```
