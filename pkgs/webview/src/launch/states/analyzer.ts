import type { RealtimeEndParams, RealtimeStartParams } from '@mse/types'

import { ipc } from '../ipc'

type JsonRpcId = string | number | null

type JsonRpcNotification = {
  jsonrpc: '2.0'
  method: string
  params?: unknown
}

type JsonRpcRequest = JsonRpcNotification & {
  id: JsonRpcId
}

type JsonRpcResponse =
  | {
      jsonrpc: '2.0'
      id: JsonRpcId
      result: unknown
    }
  | {
      jsonrpc: '2.0'
      id: JsonRpcId
      error: {
        code: number
        message: string
      }
    }

type RealtimeEventItem = {
  seq: number
  at: number
  msg: string
  details: Record<string, unknown>
}

type SnapshotReplayPlan = {
  sessionId: string
  fromSeq: number
  toSeq: number
  events: RealtimeEventItem[]
  maxBatchSize: number
}

type RecoDetailData = {
  info: maa.RecoDetailWithoutDraws
  raw: string
  draws: string[]
}

type CachedImageRefs = {
  raw: number
  draws: number[]
}

type CachedImageItem = {
  dataUrl: string
  taskId: number | null
}

const PROTOCOL_VERSION = 1
const JSON_RPC_VERSION = '2.0' as const

const ERROR_NOT_FOUND = -32001
const ERROR_SESSION_NOT_FOUND = -32002
const ERROR_INVALID_PARAMS = -32004
const ERROR_INTERNAL = -32005

const PUSH_INTERVAL_MS = 20
const MAX_PUSH_BATCH_SIZE = 200

class ProtocolError extends Error {
  code: number

  constructor(code: number, message: string) {
    super(message)
    this.code = code
  }
}

function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null
}

function parseIncomingMessage(data: unknown): JsonRpcRequest | JsonRpcNotification | null {
  let parsed: unknown = data
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      return null
    }
  }

  if (!isRecord(parsed) || parsed['jsonrpc'] !== JSON_RPC_VERSION) {
    return null
  }

  const method = parsed['method']
  if (typeof method !== 'string') {
    return null
  }

  if ('id' in parsed) {
    const id = parsed['id']
    if (!(typeof id === 'string' || typeof id === 'number' || id === null)) {
      return null
    }
    return {
      jsonrpc: JSON_RPC_VERSION,
      id: id as JsonRpcId,
      method,
      params: parsed['params']
    }
  }

  return {
    jsonrpc: JSON_RPC_VERSION,
    method,
    params: parsed['params']
  }
}

function normalizeRpcError(error: unknown) {
  if (error instanceof ProtocolError) {
    return {
      code: error.code,
      message: error.message
    }
  }
  if (error instanceof Error) {
    return {
      code: ERROR_INTERNAL,
      message: error.message
    }
  }
  return {
    code: ERROR_INTERNAL,
    message: 'internal error'
  }
}

class LaunchAnalyzerBridge {
  private iframeWindow: Window | null = null
  private ready = false
  private started = false

  private session: RealtimeStartParams | null = null
  private sessionEnded = false
  private seq = 0

  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private themeTimer: ReturnType<typeof setTimeout> | null = null

  private readonly pendingLiveEvents: RealtimeEventItem[] = []
  private readonly historyEvents: RealtimeEventItem[] = []
  private outboundQueue: JsonRpcNotification[] = []

  private nextCachedImageId = 1
  private readonly cachedImageById = new Map<number, CachedImageItem>()
  private readonly recoDetailByTaskAndId = new Map<string, RecoDetailData>()
  private readonly actionDetailByTaskAndId = new Map<string, unknown>()
  private readonly pendingRecoDetailKeys = new Set<string>()
  private readonly pendingActionDetailKeys = new Set<string>()
  private currentTaskId: number | null = null

  private readonly handleWindowMessage = (event: MessageEvent) => {
    if (!this.iframeWindow || event.source !== this.iframeWindow) {
      return
    }
    const message = parseIncomingMessage(event.data)
    if (!message) {
      return
    }

    if ('id' in message) {
      void this.handleRequest(message)
      return
    }

    if (message.method === 'bridge.ready') {
      this.ready = true
      this.sendBridgeHello()
      this.syncThemeNow()
      this.flushLiveNow()
      this.drainOutboundQueue()
    }
  }

  private readonly handleWindowKeydown = (event: KeyboardEvent) => {
    if (!this.iframeWindow) {
      return
    }
    this.enqueueNotification('bridge.keydown', {
      key: event.key,
      code: event.code,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
      repeat: event.repeat
    })
    this.drainOutboundQueue()
  }

  private readonly htmlObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'style') {
        this.syncTheme()
      }
    }
  })

  private readonly bodyObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class') {
        this.syncTheme()
      }
    }
  })

  start() {
    if (this.started) {
      return
    }
    this.started = true

    window.addEventListener('message', this.handleWindowMessage)
    window.addEventListener('keydown', this.handleWindowKeydown, true)

    this.htmlObserver.observe(document.documentElement, { attributes: true })
    this.bodyObserver.observe(document.body, { attributes: true })
    this.syncThemeNow()
  }

  dispose() {
    if (!this.started) {
      return
    }
    this.started = false

    window.removeEventListener('message', this.handleWindowMessage)
    window.removeEventListener('keydown', this.handleWindowKeydown, true)

    this.htmlObserver.disconnect()
    this.bodyObserver.disconnect()

    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    if (this.themeTimer) {
      clearTimeout(this.themeTimer)
      this.themeTimer = null
    }
  }

  setIframe(iframe: HTMLIFrameElement | null) {
    const nextWindow = iframe?.contentWindow ?? null
    if (this.iframeWindow === nextWindow) {
      return
    }

    this.iframeWindow = nextWindow
    this.ready = false
    if (!this.iframeWindow) {
      return
    }

    this.sendBridgeHello()
    this.syncThemeNow()
    this.drainOutboundQueue()
  }

  onRealtimeStart(params: RealtimeStartParams) {
    this.session = params
    this.sessionEnded = false
    this.seq = 0

    this.pendingLiveEvents.length = 0
    this.historyEvents.length = 0
    this.outboundQueue = this.outboundQueue.filter(item => item.method.startsWith('bridge.'))
    this.clearCachedImages()
    this.clearDetailCaches()

    this.enqueueNotification('realtime.start', params)
    this.drainOutboundQueue()
  }

  onRealtimeEnd(params: RealtimeEndParams) {
    if (!this.session || this.session.sessionId !== params.sessionId || this.sessionEnded) {
      return
    }
    this.sessionEnded = true

    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    this.flushLiveNow()

    this.enqueueNotification('realtime.end', {
      sessionId: params.sessionId,
      reason: params.reason,
      finalSeq: this.seq,
      endedAt: params.endedAt
    })
    this.drainOutboundQueue()
  }

  onNotifyStatus(msg: unknown) {
    if (!this.session) {
      this.onRealtimeStart({
        sessionId: `fallback-${Date.now()}`,
        instanceId: 'unknown',
        source: 'maa-support-extension',
        startedAt: Date.now()
      })
    }

    if (!this.session || this.sessionEnded) {
      return
    }

    const rawMsg = msg as Record<string, unknown>
    const msgName = typeof rawMsg['msg'] === 'string' ? rawMsg['msg'] : 'unknown'
    const taskId = this.readIntegerField(rawMsg, 'task_id')
    if (taskId !== null) {
      this.currentTaskId = taskId
    }

    const details: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(rawMsg)) {
      if (key !== 'msg') {
        details[key] = value
      }
    }

    this.seq += 1
    const event: RealtimeEventItem = {
      seq: this.seq,
      at: Date.now(),
      msg: msgName,
      details
    }
    this.pendingLiveEvents.push(event)
    this.historyEvents.push(event)
    void this.prefetchDetail(rawMsg, msgName, taskId)

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null
        this.flushLiveNow()
      }, PUSH_INTERVAL_MS)
    }
  }

  private syncTheme() {
    if (this.themeTimer) {
      clearTimeout(this.themeTimer)
    }
    this.themeTimer = setTimeout(() => {
      this.themeTimer = null
      this.syncThemeNow()
    }, 50)
  }

  private syncThemeNow() {
    if (!this.iframeWindow) {
      return
    }
    this.enqueueNotification('bridge.updateTheme', {
      htmlStyle: document.documentElement.getAttribute('style') ?? '',
      bodyClass: document.body.className
    })
    this.drainOutboundQueue()
  }

  private sendBridgeHello() {
    this.enqueueNotification('bridge.hello', {
      protocolVersion: PROTOCOL_VERSION,
      from: 'maa-support-extension',
      supportVersion: this.session?.supportVersion
    })
  }

  private flushLiveNow() {
    if (!this.session || this.pendingLiveEvents.length === 0) {
      return
    }

    while (this.pendingLiveEvents.length > 0) {
      const events = this.pendingLiveEvents.splice(0, MAX_PUSH_BATCH_SIZE)
      this.enqueueNotification('realtime.push', {
        sessionId: this.session.sessionId,
        mode: 'live',
        seqStart: events[0]!.seq,
        seqEnd: events[events.length - 1]!.seq,
        events
      })
    }
    this.drainOutboundQueue()
  }

  private enqueueNotification(method: string, params?: unknown) {
    this.outboundQueue.push({
      jsonrpc: JSON_RPC_VERSION,
      method,
      params
    })
  }

  private drainOutboundQueue() {
    if (!this.iframeWindow || this.outboundQueue.length === 0) {
      return
    }

    const pending: JsonRpcNotification[] = []
    for (const message of this.outboundQueue) {
      if (!this.ready && !message.method.startsWith('bridge.')) {
        pending.push(message)
        continue
      }
      this.iframeWindow.postMessage(JSON.stringify(message), '*')
    }
    this.outboundQueue = pending
  }

  private async handleRequest(message: JsonRpcRequest) {
    try {
      if (message.method === 'query.detail') {
        const result = await this.handleQueryDetail(message.params)
        this.postResponse({
          jsonrpc: JSON_RPC_VERSION,
          id: message.id,
          result
        })
        return
      }

      if (message.method === 'realtime.snapshot.request') {
        const plan = this.handleSnapshotRequest(message.params)
        this.postResponse({
          jsonrpc: JSON_RPC_VERSION,
          id: message.id,
          result: {
            accepted: true,
            sessionId: plan.sessionId,
            fromSeq: plan.fromSeq,
            toSeq: plan.toSeq,
            totalEvents: plan.events.length
          }
        })
        this.pushSnapshot(plan)
        return
      }

      throw new ProtocolError(-32601, `method not found: ${message.method}`)
    } catch (error) {
      this.postResponse({
        jsonrpc: JSON_RPC_VERSION,
        id: message.id,
        error: normalizeRpcError(error)
      })
    }
  }

  private postResponse(data: JsonRpcResponse) {
    if (!this.iframeWindow) {
      return
    }
    this.iframeWindow.postMessage(JSON.stringify(data), '*')
  }

  private async handleQueryDetail(raw: unknown) {
    const params = this.parseRecord(raw, 'query.detail params')
    const sessionId = this.parseString(params['sessionId'], 'query.detail.sessionId')
    const target = this.parseString(params['target'], 'query.detail.target')
    const id = this.parseInteger(params['id'], 'query.detail.id')
    const taskId = this.parseQueryDetailTaskId(params)

    if (!this.session || this.session.sessionId !== sessionId) {
      throw new ProtocolError(ERROR_SESSION_NOT_FOUND, 'session not found')
    }

    if (target === 'reco') {
      const scopedTaskId = this.requireQueryDetailTaskId(taskId, 'reco')
      const cachedReco = this.recoDetailByTaskAndId.get(this.detailCacheKey(scopedTaskId, id))
      if (cachedReco) {
        const refs = this.cacheRecoImages(cachedReco, scopedTaskId)
        return {
          target,
          id,
          data: {
            info: cachedReco.info,
            cached_image: refs
          }
        }
      }
      if (this.currentTaskId !== null && scopedTaskId !== this.currentTaskId) {
        throw new ProtocolError(ERROR_NOT_FOUND, 'detail not found')
      }

      const data = await ipc.call({
        command: 'requestReco',
        reco_id: id
      })
      const recoData = this.parseRecoDetailData(data)
      if (!recoData) {
        throw new ProtocolError(ERROR_NOT_FOUND, 'detail not found')
      }
      this.recoDetailByTaskAndId.set(this.detailCacheKey(scopedTaskId, id), recoData)

      const cached = this.cacheRecoImages(recoData, scopedTaskId)
      return {
        target,
        id,
        data: {
          info: recoData.info,
          cached_image: cached
        }
      }
    }

    if (target === 'action') {
      const scopedTaskId = this.requireQueryDetailTaskId(taskId, 'action')
      const cachedAction = this.actionDetailByTaskAndId.get(this.detailCacheKey(scopedTaskId, id))
      if (cachedAction) {
        return {
          target,
          id,
          data: {
            info: cachedAction
          }
        }
      }
      if (this.currentTaskId !== null && scopedTaskId !== this.currentTaskId) {
        throw new ProtocolError(ERROR_NOT_FOUND, 'detail not found')
      }

      const data = await ipc.call({
        command: 'requestAct',
        action_id: id
      })
      if (!data) {
        throw new ProtocolError(ERROR_NOT_FOUND, 'detail not found')
      }
      this.actionDetailByTaskAndId.set(this.detailCacheKey(scopedTaskId, id), data)
      return {
        target,
        id,
        data: {
          info: data
        }
      }
    }

    if (target === 'cached_image') {
      const image = this.cachedImageById.get(id)
      if (!image) {
        throw new ProtocolError(ERROR_NOT_FOUND, 'detail not found')
      }
      if (taskId !== null && image.taskId !== null && image.taskId !== taskId) {
        throw new ProtocolError(ERROR_NOT_FOUND, 'detail not found')
      }
      return {
        target,
        id,
        data: {
          dataUrl: image.dataUrl
        }
      }
    }

    throw new ProtocolError(ERROR_INVALID_PARAMS, 'invalid target')
  }

  private handleSnapshotRequest(raw: unknown): SnapshotReplayPlan {
    const params = this.parseRecord(raw, 'realtime.snapshot.request params')
    const sessionId = this.parseString(params['sessionId'], 'realtime.snapshot.request.sessionId')
    const lastSeq = this.parseInteger(params['lastSeq'], 'realtime.snapshot.request.lastSeq')

    if (!this.session || this.session.sessionId !== sessionId) {
      throw new ProtocolError(ERROR_SESSION_NOT_FOUND, 'session not found')
    }

    const maxBatchSizeRaw = params['maxBatchSize']
    const maxBatchSize =
      maxBatchSizeRaw === undefined
        ? MAX_PUSH_BATCH_SIZE
        : Math.max(1, this.parseInteger(maxBatchSizeRaw, 'realtime.snapshot.request.maxBatchSize'))

    const events = this.historyEvents.filter(item => item.seq > lastSeq)
    const fromSeq = events.length > 0 ? events[0]!.seq : lastSeq
    const toSeq = events.length > 0 ? events[events.length - 1]!.seq : lastSeq

    return {
      sessionId,
      fromSeq,
      toSeq,
      events,
      maxBatchSize
    }
  }

  private pushSnapshot(plan: SnapshotReplayPlan) {
    let pushedBatches = 0
    let pushedEvents = 0

    for (let i = 0; i < plan.events.length; i += plan.maxBatchSize) {
      const events = plan.events.slice(i, i + plan.maxBatchSize)
      if (events.length === 0) {
        continue
      }
      pushedBatches += 1
      pushedEvents += events.length
      this.enqueueNotification('realtime.push', {
        sessionId: plan.sessionId,
        mode: 'snapshot',
        seqStart: events[0]!.seq,
        seqEnd: events[events.length - 1]!.seq,
        events
      })
    }

    this.enqueueNotification('realtime.snapshot.end', {
      sessionId: plan.sessionId,
      fromSeq: plan.fromSeq,
      toSeq: plan.toSeq,
      pushedBatches,
      pushedEvents
    })
    this.drainOutboundQueue()
  }

  private parseRecord(data: unknown, key: string): Record<string, unknown> {
    if (!isRecord(data)) {
      throw new ProtocolError(ERROR_INVALID_PARAMS, `${key} should be object`)
    }
    return data
  }

  private parseString(data: unknown, key: string): string {
    if (typeof data !== 'string' || !data.length) {
      throw new ProtocolError(ERROR_INVALID_PARAMS, `${key} should be string`)
    }
    return data
  }

  private parseInteger(data: unknown, key: string): number {
    if (typeof data !== 'number' || !Number.isInteger(data)) {
      throw new ProtocolError(ERROR_INVALID_PARAMS, `${key} should be integer`)
    }
    return data
  }

  private parseOptionalInteger(data: unknown, key: string): number | null {
    if (data === undefined || data === null) {
      return null
    }
    return this.parseInteger(data, key)
  }

  private parseQueryDetailTaskId(params: Record<string, unknown>): number | null {
    const taskIdCamel = this.parseOptionalInteger(params['taskId'], 'query.detail.taskId')
    const taskIdSnake = this.parseOptionalInteger(params['task_id'], 'query.detail.task_id')
    if (taskIdCamel !== null && taskIdSnake !== null && taskIdCamel !== taskIdSnake) {
      throw new ProtocolError(ERROR_INVALID_PARAMS, 'query.detail.taskId and task_id mismatch')
    }

    return taskIdCamel ?? taskIdSnake
  }

  private requireQueryDetailTaskId(taskId: number | null, target: 'reco' | 'action'): number {
    if (taskId === null) {
      throw new ProtocolError(
        ERROR_INVALID_PARAMS,
        `query.detail.taskId or task_id is required for target ${target}`
      )
    }
    return taskId
  }

  private parseRecoDetailData(data: unknown): RecoDetailData | null {
    if (!isRecord(data)) {
      return null
    }

    const info = data['info']
    const raw = data['raw']
    const draws = data['draws']
    if (
      !info ||
      typeof raw !== 'string' ||
      !Array.isArray(draws) ||
      draws.some(entry => typeof entry !== 'string')
    ) {
      return null
    }

    return {
      info: info as maa.RecoDetailWithoutDraws,
      raw,
      draws
    }
  }

  private clearCachedImages() {
    this.nextCachedImageId = 1
    this.cachedImageById.clear()
  }

  private clearDetailCaches() {
    this.currentTaskId = null
    this.recoDetailByTaskAndId.clear()
    this.actionDetailByTaskAndId.clear()
    this.pendingRecoDetailKeys.clear()
    this.pendingActionDetailKeys.clear()
  }

  private detailCacheKey(taskId: number, id: number) {
    return `${taskId}:${id}`
  }

  private readIntegerField(raw: Record<string, unknown>, field: string): number | null {
    const value = raw[field]
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      return null
    }
    return value
  }

  private async prefetchDetail(
    rawMsg: Record<string, unknown>,
    msgName: string,
    taskId: number | null
  ) {
    if (taskId === null) {
      return
    }

    if (msgName === 'Recognition.Succeeded' || msgName === 'Recognition.Failed') {
      const recoId = this.readIntegerField(rawMsg, 'reco_id')
      if (recoId !== null) {
        await this.prefetchRecoDetail(taskId, recoId)
      }
      return
    }

    if (msgName === 'Action.Succeeded' || msgName === 'Action.Failed') {
      const actionId = this.readIntegerField(rawMsg, 'action_id')
      if (actionId !== null) {
        await this.prefetchActionDetail(taskId, actionId)
      }
    }
  }

  private async prefetchRecoDetail(taskId: number, recoId: number) {
    const key = this.detailCacheKey(taskId, recoId)
    if (this.recoDetailByTaskAndId.has(key) || this.pendingRecoDetailKeys.has(key)) {
      return
    }

    this.pendingRecoDetailKeys.add(key)
    try {
      const data = await ipc.call({
        command: 'requestReco',
        reco_id: recoId
      })
      const recoData = this.parseRecoDetailData(data)
      if (recoData) {
        this.recoDetailByTaskAndId.set(key, recoData)
      }
    } finally {
      this.pendingRecoDetailKeys.delete(key)
    }
  }

  private async prefetchActionDetail(taskId: number, actionId: number) {
    const key = this.detailCacheKey(taskId, actionId)
    if (this.actionDetailByTaskAndId.has(key) || this.pendingActionDetailKeys.has(key)) {
      return
    }

    this.pendingActionDetailKeys.add(key)
    try {
      const data = await ipc.call({
        command: 'requestAct',
        action_id: actionId
      })
      if (data) {
        this.actionDetailByTaskAndId.set(key, data)
      }
    } finally {
      this.pendingActionDetailKeys.delete(key)
    }
  }

  private cacheRecoImages(data: RecoDetailData, taskId: number | null): CachedImageRefs {
    const rawId = this.nextCachedImageId
    this.nextCachedImageId += 1
    this.cachedImageById.set(rawId, {
      dataUrl: data.raw,
      taskId
    })

    const drawIds: number[] = []
    for (let i = 0; i < data.draws.length; i += 1) {
      const drawId = this.nextCachedImageId
      this.nextCachedImageId += 1
      drawIds.push(drawId)
      this.cachedImageById.set(drawId, {
        dataUrl: data.draws[i]!,
        taskId
      })
    }

    return {
      raw: rawId,
      draws: drawIds
    }
  }
}

export const analyzerBridge = new LaunchAnalyzerBridge()
