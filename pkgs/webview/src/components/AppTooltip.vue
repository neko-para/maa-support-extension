<script lang="ts">
import { NTooltip } from 'naive-ui'
import type { PopoverPlacement } from 'naive-ui/es/popover'
import { Comment, cloneVNode, computed, defineComponent, h, onBeforeUnmount, ref, watch } from 'vue'

import { tooltipDisabled } from '../utils/tooltip'

// naive-ui 的 hover 提示按 mouseenter 计时，指针扫过按钮就会弹；宽度也不设限，
// 长文案会顶满 webview 视口后被面板边缘裁掉。这里接管显示时机与宽度。
const MOVE = 3 // 位移超过该值算仍在移动，重新计时
const MAX_WIDTH = 320
const WIDTH_RATIO = 0.75 // 宽度上限占面板宽度
const SIDE_GAP = 32 // 贴边对齐时与面板边缘的间距

/**
 * 统一的 tooltip：`delay` 为指针停住多久才显示，其余属性原样交给 naive-ui。
 *
 * 用渲染函数克隆 `#trigger` 的 vnode 来挂指针事件，而不是套一层包装组件——
 * naive-ui 的定位指令要求 trigger 的 vnode 根节点是 DOM 元素，多包一层组件会让指令落空。
 */
export default defineComponent({
  name: 'AppTooltip',
  inheritAttrs: false,
  props: {
    disabled: { type: Boolean, default: undefined },
    delay: { type: Number, default: 500 }
  },
  setup(props, { attrs, slots }) {
    const isHidden = computed(() => props.disabled ?? tooltipDisabled.value)
    const shown = ref(false)
    const width = ref(MAX_WIDTH)
    const align = ref<PopoverPlacement>('top')

    let timer: ReturnType<typeof setTimeout> | undefined
    let lastPoint: { x: number; y: number } | null = null

    function arm() {
      clearTimeout(timer)
      timer = setTimeout(() => {
        timer = undefined
        if (!isHidden.value) {
          shown.value = true
        }
      }, props.delay)
    }

    /** 宽度上限与对齐：居中放不下就贴住空间更大的一侧，并把宽度压到那侧放得下 */
    function plan(e: MouseEvent) {
      const view = document.documentElement.clientWidth || window.innerWidth
      const rect = (e.currentTarget as Element).getBoundingClientRect()
      const cap = Math.min(MAX_WIDTH, Math.round(view * WIDTH_RATIO))
      const center = rect.left + rect.width / 2
      const placement = attrs.placement as string | undefined
      if (placement?.startsWith('left')) {
        width.value = Math.min(cap, rect.left - SIDE_GAP)
      } else if (placement?.startsWith('right')) {
        width.value = Math.min(cap, view - rect.right - SIDE_GAP)
      } else if (center >= cap / 2 && center + cap / 2 <= view) {
        width.value = cap
        align.value = 'top'
      } else if (view - rect.left >= rect.right) {
        width.value = Math.min(cap, view - rect.left - SIDE_GAP)
        align.value = 'top-start'
      } else {
        width.value = Math.min(cap, rect.right - SIDE_GAP)
        align.value = 'top-end'
      }
    }

    function handlePointerEnter(e: MouseEvent) {
      if (isHidden.value) return
      lastPoint = { x: e.clientX, y: e.clientY }
      plan(e)
      arm()
    }

    function handlePointerMove(e: MouseEvent) {
      if (isHidden.value || shown.value) return
      const prev = lastPoint
      lastPoint = { x: e.clientX, y: e.clientY }
      if (!prev || Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < MOVE) return
      plan(e)
      arm()
    }

    function handlePointerLeave() {
      clearTimeout(timer)
      lastPoint = null
      shown.value = false
    }

    watch(isHidden, hidden => {
      if (hidden) {
        handlePointerLeave()
      }
    })

    onBeforeUnmount(() => clearTimeout(timer))

    /** naive-ui 只按第一个非注释 vnode 定位，这里也只给同一个节点挂事件 */
    function renderTrigger() {
      const children = slots.trigger?.() ?? null
      if (!children) return children
      const single = !Array.isArray(children)
      const list = single ? [children] : children
      const index = list.findIndex(node => node.type !== Comment)
      if (index < 0) return children
      list[index] = cloneVNode(list[index]!, {
        onMouseenter: handlePointerEnter,
        onMousemove: handlePointerMove,
        onMouseleave: handlePointerLeave
      })
      return single ? list[0] : list
    }

    return () => {
      if (isHidden.value) {
        return slots.trigger?.() ?? null
      }
      return h(
        NTooltip,
        {
          ...attrs,
          trigger: 'manual',
          show: shown.value,
          placement: (attrs.placement as PopoverPlacement | undefined) ?? align.value,
          // border-box 让宽度上限把 popover 自身 padding 也算进去
          style: { maxWidth: `${width.value}px`, boxSizing: 'border-box' }
        },
        { trigger: renderTrigger, default: () => slots.default?.() }
      )
    }
  }
})
</script>
