<script setup lang="ts">
import { NCode, NScrollbar } from 'naive-ui'
import * as babel from 'prettier/plugins/babel'
import estree from 'prettier/plugins/estree'
import * as prettier from 'prettier/standalone'
import { ref, watch } from 'vue'

const props = defineProps<{
  code: string
}>()

const formatted = ref<string>('')

async function format(code: string) {
  return await prettier.format(code, {
    plugins: [babel, estree],
    parser: 'json',
    printWidth: 50
  })
}

watch(
  () => props.code,
  async code => {
    formatted.value = await format(code)
  },
  {
    immediate: true
  }
)
</script>

<template>
  <n-scrollbar style="max-height: 80vh; background-color: var(--vscode-textPreformat-background)">
    <n-code language="json" :code="formatted" word-wrap> </n-code>
  </n-scrollbar>
</template>
