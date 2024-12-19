import type { VscodeSingleSelect } from '@vscode-elements/elements'
import type { Option } from '@vscode-elements/elements/dist/includes/vscode-select/types'
import type { VscCollapsibleToggleEvent } from '@vscode-elements/elements/dist/vscode-collapsible/vscode-collapsible'
import { type SetupContext, cloneVNode } from 'vue'

export function VscButton(
  props: {
    loading?: boolean
    disabled?: boolean
    onClick?: () => void
  },
  context: SetupContext<{}>
) {
  return (
    <vscode-button
      class="fixed"
      icon={props.loading ? 'loading' : undefined}
      iconSpin
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {context.slots.default?.()}
    </vscode-button>
  )
}

export function VscCollapsible(
  props: {
    title?: string
    description?: string
    open?: boolean
  },
  context: SetupContext<{
    'update:open': [boolean]
  }>
) {
  const defaultSlot = context.slots.default?.() ?? []
  const actionsSlot = (context.slots.actions?.() ?? []).map(vnode => {
    return cloneVNode(vnode, {
      slot: 'actions'
    })
  })
  const decorationsSlot = (context.slots.decorations?.() ?? []).map(vnode => {
    return cloneVNode(vnode, {
      slot: 'decorations'
    })
  })

  return (
    <vscode-collapsible
      description={props.description}
      open={props.open}
      title={props.title}
      onVscCollapsibleToggle={(e: VscCollapsibleToggleEvent) => {
        context.emit('update:open', e.detail.open)
      }}
    >
      {[...defaultSlot, ...actionsSlot, ...decorationsSlot]}
    </vscode-collapsible>
  )
}

export function VscDivider() {
  return <vscode-divider></vscode-divider>
}

export function VscScrollable(props: {}, context: SetupContext<{}>) {
  return (
    <vscode-scrollable style="flex: 1 1 auto;overflow-y: auto;">
      {context.slots.default?.()}
    </vscode-scrollable>
  )
}

export type VscSingleSelectOption = {
  label?: string
  value: string
  description?: string
  disabled?: boolean
}

export function VscSingleSelect(
  props: {
    modelValue?: string
    options: VscSingleSelectOption[]
    disabled?: boolean
  },
  context: SetupContext<{
    'update:modelValue': [string | undefined]
  }>
) {
  return (
    <vscode-single-select
      value={props.modelValue}
      onChange={(e: Event) => {
        context.emit('update:modelValue', (e.target as VscodeSingleSelect).value)
      }}
      options={props.options.map(opt => {
        return {
          label: opt.label ?? opt.value,
          value: opt.value,
          description: opt.description ?? '',
          selected: false,
          disabled: opt.disabled ?? false
        } satisfies Option
      })}
      disabled={props.disabled}
    ></vscode-single-select>
  )
}
