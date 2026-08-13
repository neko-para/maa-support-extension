import { randomUUID } from 'node:crypto'
import * as path from 'node:path'
import * as vscode from 'vscode'

import type { AbsolutePath } from '@nekosu/maa-pipeline-manager'

import { isMaaAssistantArknights } from '../utils/fs'
import { logger } from '../utils/logger'
import { BaseService } from './context'
import {
  type MpeConfig,
  type MpeProtocolMessage,
  hasDocumentVersionConflict,
  isCompatibleMpeMessage,
  isCurrentDocumentSnapshot,
  isMpeReadyForRequest,
  isSeparatedMpeSidecar,
  isSidecarNotFound,
  mergePipelineAndConfig,
  mpeProtocol,
  mpeProtocolVersion,
  mpeSidecarPath,
  normalizeExternalUrl,
  parseMpeConfig,
  parsePipeline,
  splitPipelineAndConfig,
  stringifyMpeConfig,
  updatePipelineText
} from './mpeProtocol'
import { interfaceService } from './registry'

const repositoryUrl = 'https://github.com/neko-para/maa-support-extension'
const defaultUrl = 'https://mpe.codax.site/stable/'
const snapshotRetries = 3

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function errorCode(error: unknown, fallback = 'save_failed') {
  if (!error || typeof error !== 'object' || !('code' in error)) return fallback
  return typeof error.code === 'string' ? error.code : fallback
}

function documentRange(document: vscode.TextDocument) {
  return new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length))
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }
    return entities[character]
  })
}

export class MpeService extends BaseService {
  private readonly panels = new Map<string, MpePanel>()

  async init() {
    const updateAvailability = () =>
      vscode.commands.executeCommand(
        'setContext',
        'maa.pipelineEditorAvailable',
        !!vscode.window.activeTextEditor && this.supported(vscode.window.activeTextEditor.document)
      )
    this.defer = vscode.window.onDidChangeActiveTextEditor(updateAvailability)
    this.defer = interfaceService.onResourceChanged(updateAvailability)
    await updateAvailability()
    this.defer = vscode.workspace.onDidCloseTextDocument(doc => {
      this.panels.get(doc.uri.toString())?.close()
    })
  }

  dispose() {
    for (const panel of this.panels.values()) panel.panel.dispose()
    this.panels.clear()
    super.dispose()
  }

  async open(uri: vscode.Uri) {
    const doc = await vscode.workspace.openTextDocument(uri)
    if (!this.supported(doc)) {
      vscode.window.showErrorMessage(
        `Cannot open ${path.basename(uri.fsPath)} in MPE: unsupported Pipeline file`
      )
      return false
    }
    const key = uri.toString()
    const existing = this.panels.get(key)
    if (existing) {
      existing.panel.reveal()
      return true
    }
    const panel = new MpePanel(doc)
    this.panels.set(key, panel)
    panel.onDispose = () => this.panels.delete(key)
    await panel.start()
    return true
  }

  supported(doc: vscode.TextDocument) {
    if (
      isMaaAssistantArknights ||
      doc.uri.scheme !== 'file' ||
      !/\.(json|jsonc)$/i.test(doc.fileName)
    )
      return false
    const layer = interfaceService.interfaceBundle?.locateLayer(doc.uri.fsPath as AbsolutePath)
    return !!layer && !layer[2] && !interfaceService.shouldFilter(doc.uri)
  }
}

class MpePanel implements vscode.Disposable {
  readonly panel: vscode.WebviewPanel
  private ready = false
  private disposed = false
  private queue: MpeProtocolMessage[] = []
  private pendingSave?: { requestId: string; documentVersion: number; force: boolean }
  private loadedDocumentVersion?: number
  private separatedConfigUri?: vscode.Uri
  private saveTimeout?: ReturnType<typeof setTimeout>
  private requestCounter = 0
  private loadSeq = 0
  private readonly disposables: vscode.Disposable[] = []
  onDispose = () => {}

  constructor(private readonly document: vscode.TextDocument) {
    this.panel = vscode.window.createWebviewPanel(
      'maa.mpe',
      `MPE: ${path.basename(document.fileName)}`,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: []
      }
    )
    this.panel.webview.options = { enableScripts: true, localResourceRoots: [] }
    this.panel.webview.onDidReceiveMessage(
      message => this.receive(message),
      undefined,
      this.disposables
    )
    this.panel.onDidDispose(() => this.dispose(), undefined, this.disposables)
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document.uri.toString() === this.document.uri.toString() && !this.pendingSave) {
          logger.info(`MPE source document changed: ${path.basename(this.document.fileName)}`)
        }
      })
    )
    this.disposables.push(
      vscode.workspace.onDidRenameFiles(event => {
        if (event.files.some(file => file.oldUri.toString() === this.document.uri.toString()))
          this.close()
      }),
      vscode.workspace.onDidDeleteFiles(event => {
        if (event.files.some(uri => uri.toString() === this.document.uri.toString())) this.close()
      })
    )
  }

  async start() {
    const url = vscode.workspace.getConfiguration('maa').get('pipelineEditorUrl', defaultUrl)
    let parsed: URL
    try {
      parsed = new URL(url)
      const localHttp =
        parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
      if (parsed.protocol !== 'https:' && !localHttp)
        throw new Error('URL must use HTTPS (HTTP is only allowed for localhost)')
    } catch (error) {
      this.panel.webview.html = `<p>MPE URL is invalid: ${escapeHtml(String(error))}</p>`
      return
    }
    const origin = parsed.origin
    const frameUrl = new URL(parsed)
    frameUrl.searchParams.set('embed', 'true')
    frameUrl.searchParams.set('origin', 'vscode-maa')
    const nonce = randomUUID()
    const csp = `default-src 'none'; frame-src ${origin}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';`
    this.initMessage = {
      protocol: mpeProtocol,
      version: mpeProtocolVersion,
      type: 'mpe:init',
      requestId: `mse-init-${Date.now()}-${++this.requestCounter}`,
      payload: {
        capabilities: {
          readOnly: false,
          allowCopy: true,
          allowUndoRedo: true,
          allowAutoLayout: true,
          allowSearch: true,
          allowCustomTemplate: true
        },
        ui: { hideHeader: false, hideToolbar: false, hiddenPanels: [] },
        host: { id: 'mse', name: 'MSE', repositoryUrl }
      }
    }
    this.panel.webview.html = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${csp}"><style>html,body{box-sizing:border-box;margin:0;padding:0;width:100%;height:100%;overflow:hidden}iframe{display:block;width:100%;height:100%;border:0}</style></head><body><iframe id="mpe" src="${frameUrl}" title="MaaPipelineEditor" allow="clipboard-read; clipboard-write; clipboard-sanitized-write"></iframe><script nonce="${nonce}">
const api=acquireVsCodeApi(), frame=document.getElementById('mpe');
window.addEventListener('message',e=>{if(e.source===frame.contentWindow&&e.origin==='${origin}'&&e.data?.protocol==='mpe-embed')api.postMessage(e.data);else if(e.source!==frame.contentWindow)frame.contentWindow?.postMessage(e.data,'${origin}')});
frame.addEventListener('load',()=>api.postMessage({builtin:'mpe-host-ready'}));
</script></body></html>`
  }

  private initMessage?: MpeProtocolMessage

  private receive(value: unknown) {
    if (asRecord(value)?.builtin === 'mpe-host-ready') {
      this.ready = false
      this.pendingSave = undefined
      this.loadSeq += 1
      if (this.saveTimeout) clearTimeout(this.saveTimeout)
      if (this.initMessage) this.panel.webview.postMessage(this.initMessage)
      return
    }
    if (!isCompatibleMpeMessage(value)) return
    const message = value
    switch (message.type) {
      case 'mpe:ready':
        if (
          !this.initMessage?.requestId ||
          !isMpeReadyForRequest(message, this.initMessage.requestId)
        )
          return
        this.ready = true
        this.flush()
        void this.load(`mse-load-${Date.now()}-${++this.requestCounter}`)
        break
      case 'mpe:reloadRequest':
        void this.load(message.requestId)
        break
      case 'mpe:saveRequest':
        this.requestSave(message)
        break
      case 'mpe:saveData':
        this.applySave(message)
        break
      case 'mpe:openExternalRequest':
        void this.openExternal(asRecord(message.payload)?.url)
        break
    }
  }

  private async load(requestId?: string) {
    const seq = ++this.loadSeq
    try {
      const snapshot = await this.pipelineSnapshot()
      if (this.disposed || seq !== this.loadSeq) {
        return
      }
      this.loadedDocumentVersion = snapshot.version
      this.send({
        protocol: mpeProtocol,
        version: mpeProtocolVersion,
        type: 'mpe:loadPipeline',
        requestId,
        payload: { fileName: path.basename(this.document.fileName), data: snapshot.data }
      })
    } catch (error) {
      if (this.disposed || seq !== this.loadSeq) {
        return
      }
      this.send({
        protocol: mpeProtocol,
        version: mpeProtocolVersion,
        type: 'mpe:error',
        requestId,
        payload: { code: errorCode(error, 'invalid_pipeline'), message: String(error) }
      })
    }
  }

  private sidecarUri() {
    return vscode.Uri.file(mpeSidecarPath(this.document.uri.fsPath))
  }

  private async readSidecar(uri: vscode.Uri) {
    try {
      await vscode.workspace.fs.stat(uri)
    } catch (error) {
      if (isSidecarNotFound(error)) {
        return { status: 'missing' as const }
      }
      logger.warn(`Failed to stat MPE config ${path.basename(uri.fsPath)}: ${String(error)}`)
      return { status: 'invalid' as const, error }
    }
    try {
      return {
        status: 'ok' as const,
        config: parseMpeConfig((await vscode.workspace.openTextDocument(uri)).getText())
      }
    } catch (error) {
      if (isSidecarNotFound(error)) {
        return { status: 'missing' as const }
      }
      logger.warn(`Failed to read MPE config ${path.basename(uri.fsPath)}: ${String(error)}`)
      return { status: 'invalid' as const, error }
    }
  }

  private async pipelineSnapshot() {
    const sidecarUri = this.sidecarUri()
    for (let attempt = 0; attempt < snapshotRetries; attempt++) {
      const version = this.document.version
      const pipeline = parsePipeline(this.document.getText())
      const sidecar = await this.readSidecar(sidecarUri)
      if (!isCurrentDocumentSnapshot(version, this.document.version)) {
        continue
      }
      if (sidecar.status === 'invalid') {
        throw Object.assign(new Error(`MPE config is invalid: ${String(sidecar.error)}`), {
          code: 'invalid_config'
        })
      }
      if (sidecar.status === 'missing') {
        this.separatedConfigUri = undefined
        return { data: pipeline, version }
      }
      this.separatedConfigUri = sidecarUri
      // mpe:loadPipeline only accepts a combined pipeline object, so merge the sidecar here.
      return {
        data: mergePipelineAndConfig(
          pipeline,
          sidecar.config,
          path.basename(this.document.fileName).replace(/\.(json|jsonc)$/i, ''),
          Object.keys(pipeline)
        ),
        version
      }
    }
    throw new Error('Pipeline changed while loading MPE snapshot')
  }

  private requestSave(message: MpeProtocolMessage) {
    const requestId = message.requestId
    if (!requestId || this.pendingSave) return
    const payload = asRecord(message.payload)
    this.pendingSave = {
      requestId,
      documentVersion: this.document.version,
      force: payload?.force === true
    }
    this.saveTimeout = setTimeout(() => {
      if (this.pendingSave?.requestId !== requestId) return
      this.pendingSave = undefined
      this.send({
        protocol: mpeProtocol,
        version: mpeProtocolVersion,
        type: 'mpe:saveResult',
        requestId,
        payload: {
          success: false,
          code: 'save_timeout',
          message: 'Timed out waiting for MPE save data'
        }
      })
    }, 10_000)
    this.send({
      protocol: mpeProtocol,
      version: mpeProtocolVersion,
      type: 'mpe:save',
      requestId,
      payload: {}
    })
  }

  private async applySave(message: MpeProtocolMessage) {
    const pending = this.pendingSave
    if (!pending || message.requestId !== pending.requestId) return
    this.pendingSave = undefined
    if (this.saveTimeout) clearTimeout(this.saveTimeout)
    const rejectIfChanged = () => {
      if (
        pending.force ||
        !hasDocumentVersionConflict(
          this.loadedDocumentVersion,
          pending.documentVersion,
          this.document.version
        )
      ) {
        return false
      }
      this.send({
        protocol: mpeProtocol,
        version: mpeProtocolVersion,
        type: 'mpe:saveResult',
        requestId: pending.requestId,
        payload: {
          success: false,
          code: 'document_changed',
          message: 'The host document has changed',
          canForce: true
        }
      })
      return true
    }
    try {
      if (rejectIfChanged()) {
        return
      }
      const data = asRecord(asRecord(message.payload)?.data)
      if (!data)
        throw Object.assign(new Error('MPE returned invalid Pipeline data'), {
          code: 'invalid_pipeline'
        })
      const sidecarUri = this.separatedConfigUri ?? this.sidecarUri()
      const sidecar = await this.readSidecar(sidecarUri)
      const separated = isSeparatedMpeSidecar(!!this.separatedConfigUri, sidecar)
      if (rejectIfChanged()) {
        return
      }
      const next = separated ? splitPipelineAndConfig(data) : undefined
      const original = this.document.getText()
      const pipelineText = updatePipelineText(
        original,
        parsePipeline(original),
        next?.pipeline ?? data
      )
      if (rejectIfChanged()) {
        return
      }
      const edit = new vscode.WorkspaceEdit()
      if (next) {
        this.appendSidecarEdit(edit, sidecarUri, next.config)
        this.separatedConfigUri = sidecarUri
      }
      edit.replace(this.document.uri, documentRange(this.document), pipelineText)
      if (!(await vscode.workspace.applyEdit(edit)))
        throw new Error('VS Code rejected the document edit')
      this.loadedDocumentVersion = this.document.version
      this.send({
        protocol: mpeProtocol,
        version: mpeProtocolVersion,
        type: 'mpe:saveResult',
        requestId: pending.requestId,
        payload: { success: true, documentVersion: this.document.version }
      })
    } catch (error) {
      this.send({
        protocol: mpeProtocol,
        version: mpeProtocolVersion,
        type: 'mpe:saveResult',
        requestId: pending.requestId,
        payload: {
          success: false,
          code: errorCode(error),
          message: String(error)
        }
      })
    }
  }

  private appendSidecarEdit(edit: vscode.WorkspaceEdit, uri: vscode.Uri, config: MpeConfig) {
    const text = stringifyMpeConfig(config)
    const open = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString())
    if (open) {
      edit.replace(uri, documentRange(open), text)
      return
    }
    edit.createFile(uri, {
      overwrite: true,
      contents: new TextEncoder().encode(text)
    })
  }

  private async openExternal(value: unknown) {
    const url = normalizeExternalUrl(value)
    if (!url) {
      logger.warn('MPE rejected an invalid external URL request')
      return
    }

    try {
      if (!(await vscode.env.openExternal(vscode.Uri.parse(url)))) {
        logger.warn('VS Code did not open the external URL requested by MPE')
      }
    } catch (error) {
      logger.error(`Failed to open an external URL requested by MPE: ${String(error)}`)
    }
  }

  private send(message: MpeProtocolMessage) {
    if (this.disposed) return
    if (!this.ready && message.type !== 'mpe:init') this.queue.push(message)
    else this.panel.webview.postMessage(message)
  }
  private flush() {
    const queued = this.queue.splice(0)
    queued.forEach(message => this.send(message))
  }
  close() {
    if (!this.disposed) this.panel.dispose()
  }
  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.pendingSave = undefined
    if (this.saveTimeout) clearTimeout(this.saveTimeout)
    this.disposables.splice(0).forEach(disposable => disposable.dispose())
    this.onDispose()
  }
}
