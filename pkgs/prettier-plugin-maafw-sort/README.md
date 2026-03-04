# @nekosu/prettier-plugin-maafw-sort

Prettier plugin to sort keys of MaaFramework pipeline json.

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

## Playing with other plugins

Use `patchPlugin` to merge another plugin that also provides json/jsonc parser.

```typescript
import * as multilineArrays from 'prettier-plugin-multiline-arrays'

import * as maafwSort from '@nekosu/prettier-plugin-maafw-sort'

export default {
  plugins: [maafwSort.patchPlugin(multilineArrays)]
}
```
