import type { PageType } from '@maaxyz/maa-support-types'
import { v4 } from 'uuid'
import { ref } from 'vue'

import { requestHost } from './api'
import { isVscode } from './config'

export type TabData = {
  type: PageType
  id: string
}

export const activeTab = ref<string>('')
export const tabData = ref<TabData[]>([])

const tabInitData = new Map<string, unknown>()

export async function addPage(type: PageType, data?: unknown) {
  const id = v4()
  if (isVscode) {
    const succ = await requestHost('addPage', { type, id, data })
    return succ ? id : null
  } else {
    tabInitData.set(id, data)
    tabData.value.push({
      type,
      id
    })
    activeTab.value = id
    return id
  }
}

export function closePage(id: string) {
  if (isVscode) {
    // TODO
  } else {
    const idx = tabData.value.findIndex(p => p.id === id)
    if (idx !== -1) {
      tabData.value.splice(idx, 1)
    }
  }
}

export async function getPageData(id: string) {
  if (isVscode) {
    return (await requestHost('getPageData', { id }))?.data
  } else {
    return tabInitData.get(id)
  }
}
