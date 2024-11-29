<script setup lang="tsx">
import type { VscodeCollapsible } from '@vscode-elements/elements'
import type { Option } from '@vscode-elements/elements/dist/includes/vscode-select/types'
import { VscodeSingleSelect } from '@vscode-elements/elements/dist/vscode-single-select'
import { JSONStringify } from 'json-with-bigint'
import { computed, onMounted, ref } from 'vue'

import type { InterfaceConfig } from '@mse/types'

import { ipc } from './main'

const alterDisable = computed(() => {
  return ipc.context.value.interfaceRefreshing || ipc.context.value.interfaceLaunching
})

function refreshInterface() {
  ipc.postMessage({
    cmd: 'refreshInterface'
  })
}

function launchInterface() {
  ipc.postMessage({
    cmd: 'launchInterface'
  })
}

const currentInterface = computed<string | undefined>({
  set(v?: string) {
    if (v) {
      ipc.postMessage({
        cmd: 'selectInterface',
        interface: v
      })
    }
  },
  get() {
    return ipc.context.value.interfaceCurrent
  }
})

const currentResource = computed<string | undefined>({
  set(v?: string) {
    if (!ipc.context.value.interfaceObj?.resource?.find(x => x.name === v)) {
      v = undefined
    }
    if (v) {
      if (!ipc.context.value.interfaceConfigObj) {
        ipc.context.value.interfaceConfigObj = {
          resource: v
        }
      } else {
        ipc.context.value.interfaceConfigObj.resource = v
      }
    }
  },
  get() {
    return ipc.context.value.interfaceConfigObj?.resource
  }
})

const currentController = computed<string | undefined>({
  set(v?: string) {
    if (!ipc.context.value.interfaceObj?.controller?.find(x => x.name === v)) {
      v = undefined
    }
    if (v) {
      if (!ipc.context.value.interfaceConfigObj) {
        ipc.context.value.interfaceConfigObj = {
          controller: {
            name: v
          }
        }
      } else if (!ipc.context.value.interfaceConfigObj.controller) {
        ipc.context.value.interfaceConfigObj.controller = {
          name: v
        }
      } else {
        ipc.context.value.interfaceConfigObj.controller.name = v
      }
    }
  },
  get() {
    return ipc.context.value.interfaceConfigObj?.controller?.name
  }
})

const currentControllerType = computed(() => {
  return ipc.context.value.interfaceObj?.controller?.find(
    x => x.name === ipc.context.value.interfaceConfigObj?.controller?.name
  )?.type
})

const resourceOptions = computed<Option[]>(() => {
  return (
    ipc.context.value.interfaceObj?.resource?.map(i => {
      return {
        label: i.name,
        value: i.name,
        description: `${i.path}`,
        // selected: currentController.value === i.name,
        selected: false,
        disabled: false
      } satisfies Option
    }) ?? []
  )
})

const controllerOptions = computed<Option[]>(() => {
  return (
    ipc.context.value.interfaceObj?.controller?.map(i => {
      return {
        label: i.name,
        value: i.name,
        description: `${i.type}`,
        // selected: currentController.value === i.name,
        selected: false,
        disabled: false
      } satisfies Option
    }) ?? []
  )
})

const taskAddOptions = computed<Option[]>(() => {
  return (
    ipc.context.value.interfaceObj?.task?.map(i => {
      return {
        label: i.name,
        value: i.name,
        description: `${i.entry}`,
        // selected: currentController.value === i.name,
        selected: false,
        disabled: false
      } satisfies Option
    }) ?? []
  )
})

function addTask() {
  const taskName = ipc.context.value.interfaceAddTask
  if (!taskName) {
    return
  }

  const taskDesc = ipc.context.value.interfaceObj?.task?.find(x => x.name === taskName)
  if (!taskDesc) {
    return
  }

  if (!ipc.context.value.interfaceConfigObj) {
    ipc.context.value.interfaceConfigObj = {
      task: [
        {
          name: taskName,
          option: []
        }
      ]
    }
  } else if (!ipc.context.value.interfaceConfigObj.task) {
    ipc.context.value.interfaceConfigObj.task = [
      {
        name: taskName,
        option: []
      }
    ]
  } else {
    ipc.context.value.interfaceConfigObj.task.push({
      name: taskName,
      option: []
    })
  }
}

function delTask(idx: number) {
  ipc.context.value.interfaceConfigObj?.task?.splice(idx, 1)
}

function moveTask(idx: number, dir: 'up' | 'down') {
  const tasks = ipc.context.value.interfaceConfigObj?.task
  if (tasks) {
    const task = tasks.splice(idx, 1)[0]
    if (task) {
      tasks.splice(dir === 'up' ? idx - 1 : idx + 1, 0, task)
    }
  }
}

onMounted(() => {
  refreshInterface()
})

function TaskOptionPanel(props: { task: InterfaceConfig['task'][number] }) {
  const proto = ipc.context.value.interfaceObj?.task?.find(x => x.name === props.task.name)
  if (!proto) {
    return <div></div>
  }

  return (
    <div class={'col-flex'} style="padding: 0.5rem">
      {proto.option?.map((opt, idx) => {
        const optionProto = ipc.context.value.interfaceObj?.option?.[opt]
        if (!optionProto) {
          return <></>
        }

        const value = computed<string | undefined>({
          set(v?: string) {
            console.log('set!', v)
            if (v) {
              if (!props.task.option) {
                props.task.option = [
                  {
                    name: opt,
                    value: v
                  }
                ]
              } else {
                const entry = props.task.option.find(x => x.name === opt)
                if (entry) {
                  entry.value = v
                } else {
                  props.task.option.push({
                    name: opt,
                    value: v
                  })
                }
              }
            }
          },
          get() {
            const choice = props.task.option?.find(x => x.name === opt)
            return choice?.value ?? optionProto.default_case ?? optionProto.cases[0].name
          }
        })

        return (
          <div class={'row-flex'}>
            <span> {opt} </span>
            <vscode-single-select
              value={value.value}
              onChange={(v: Event) => {
                value.value = (v.target as VscodeSingleSelect).value
              }}
              options={optionProto.cases.map(i => {
                return {
                  label: i.name,
                  value: i.name,
                  description: '',
                  selected: false,
                  disabled: false
                } satisfies Option
              })}
            ></vscode-single-select>
          </div>
        )
      })}
    </div>
  )
}

function prevent(e: Event) {
  e.preventDefault()
  e.stopImmediatePropagation()
}
</script>

<template>
  <div id="root">
    <div class="row-flex" style="margin-top: 0.5rem">
      <span>配置</span>
      <vscode-single-select v-model="currentInterface" :disabled="alterDisable">
        <vscode-option v-for="(i, k) in ipc.context.value.interfaceList ?? []" :key="k">
          {{ i }}
        </vscode-option>
      </vscode-single-select>
      <vscode-button
        :icon="ipc.context.value.interfaceRefreshing ? 'loading' : undefined"
        iconSpin
        :disabled="alterDisable"
        @click="refreshInterface"
      >
        刷新
      </vscode-button>
    </div>
    <div class="row-flex">
      <span>资源</span>
      <vscode-single-select
        v-model="currentResource"
        :options="resourceOptions"
        :disabled="alterDisable"
      >
      </vscode-single-select>
    </div>
    <div class="row-flex">
      <span>控制</span>
      <div class="col-flex">
        <vscode-single-select
          v-model="currentController"
          :options="controllerOptions"
          :disabled="alterDisable"
        >
        </vscode-single-select>
        <div v-if="currentControllerType === 'Adb'">Adb配置 (未实现)</div>
        <div v-else-if="currentControllerType === 'Win32'">Desktop配置 (未实现)</div>
      </div>
    </div>
    <div class="row-flex">
      <span> 任务 </span>
      <div class="col-flex">
        <div class="row-flex">
          <vscode-single-select
            v-model="ipc.context.value.interfaceAddTask"
            :options="taskAddOptions"
            :disabled="alterDisable"
          >
          </vscode-single-select>
          <vscode-button @click="addTask" :disabled="alterDisable"> 添加 </vscode-button>
        </div>
        <div class="col-flex" style="gap: 0">
          <vscode-collapsible
            v-for="(task, k) in ipc.context.value.interfaceConfigObj?.task ?? []"
            :key="k"
            :title="task.name"
            :open="task.__vscExpand ?? true"
            @vsc-collapsible-toggle="
              (e: CustomEvent) => {
                console.log(k, (e.target as VscodeCollapsible).open)
                task.__vscExpand = (e.target as VscodeCollapsible).open
              }
            "
          >
            <vscode-icon
              name="arrow-down"
              slot="decorations"
              :disabled="
                k === (ipc.context.value.interfaceConfigObj?.task?.length ?? 0) - 1 || alterDisable
                  ? ''
                  : undefined
              "
              @click.stop="moveTask(k, 'down')"
            ></vscode-icon>
            <vscode-icon
              name="arrow-up"
              slot="decorations"
              :disabled="k === 0 || alterDisable ? '' : undefined"
              @click.stop="moveTask(k, 'up')"
            ></vscode-icon>
            <vscode-icon
              name="close"
              slot="decorations"
              @click.stop="delTask(k)"
              :disabled="alterDisable ? '' : undefined"
            ></vscode-icon>

            <TaskOptionPanel :task="task"></TaskOptionPanel>
          </vscode-collapsible>
        </div>
      </div>
    </div>
    <div class="row-flex">
      <vscode-button
        :icon="ipc.context.value.interfaceLaunching ? 'loading' : undefined"
        iconSpin
        :disabled="alterDisable"
        @click="launchInterface"
      >
        启动
      </vscode-button>
    </div>
    <vscode-divider></vscode-divider>
    <div>
      <vscode-button @click="ipc.context.value = {}"> Reset </vscode-button>
    </div>
    <vscode-scrollable id="contextDump">
      <pre>{{ JSONStringify(ipc.context.value, 2) }}</pre>
    </vscode-scrollable>
  </div>
</template>

<style scoped>
#root {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  height: 100%;
  padding: 0 0.5rem;
}

#contextDump {
  flex: 1 1 auto;
  overflow-y: auto;
}
</style>
