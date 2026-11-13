import * as fs from 'fs/promises'
import * as path from 'node:path'
import * as vscode from 'vscode'

import { locale, t } from '@nekosu/maa-locale'
import type {
  ToolAgentSetup,
  ToolFailure,
  ToolInternalTag,
  ToolResult
} from '@nekosu/maa-server-proto'
import type { CropHostState, CropHostToWeb, CropWebToHost, WebToHost } from '@nekosu/maa-types'

import { Jimp } from '../../tools/jimp'
import { imageSuffix, isMaaAssistantArknights } from '../../utils/fs'
import { logger } from '../../utils/logger'
import { getTooltipDisabled } from '../../utils/settings'
import { WebviewPanelProvider } from '../../utils/webview/panel'
import { context } from '../context'
import {
  interfaceService,
  launchService,
  nativeService,
  rootService,
  serverService,
  stateService
} from '../registry'
import type { IpcType } from '../server'
import { toPngDataUrl } from '../utils/png'
import { isCropDev } from './dev'

export interface OpenCropPayload {
  image?: string
  detail?: maa.RecoDetailWithoutDraws
}

export interface OpenCropResult {
  opened: true
  imageAccepted: boolean
  detailAccepted: boolean
}

export async function openCropPanel(ipc: IpcType, payload?: OpenCropPayload) {
  // 面板关闭期间改过的 pipeline/模板无法在这里区分，第一次识别前统一重建会话；
  // 正常关闭时 dispose 已释放过会话，这里只是补上释放失败/空窗期的兜底
  recoSessionDirty = true
  const panel = new WebviewCropPanel(ipc, 'Maa Crop')
  await panel.init()

  if (typeof payload?.image === 'string' && payload.image.trim()) {
    panel.send({
      command: 'setImage',
      image: payload.image
    })
  }
  if (payload?.detail && typeof payload.detail === 'object') {
    panel.send({
      command: 'setRecoDetail',
      detail: payload.detail
    })
  }

  return panel
}

/** 打开中的裁剪面板数量：最后一个关闭时释放快速识别缓存的 agent 会话 */
let openCropPanels = 0
let releaseTimer: NodeJS.Timeout | undefined
/**
 * 变更后 maa-server 里缓存的快速识别会话仍带着旧定义：pipeline json 与模板图片都只在
 * 新建 Resource 时重新读取（原生侧有流水线和图片缓存），所以置脏后必须真的重建一次会话，
 * 不能等空闲超时。
 */
let recoSessionDirty = false

/**
 * 释放 maa-server 里快速识别缓存的会话，等 server 回包后再返回。
 * 只在已有连接时发送：没有连接就没有会话，也不应为此拉起 server。连接在发送前断开时
 * sendRequest 会同步抛出，需要与异步拒绝一起收口。
 * 返回 false 表示释放失败、缓存仍是旧定义，调用方不能用它做识别。
 */
async function releaseRecoSession(ipc: IpcType | null): Promise<boolean> {
  clearTimeout(releaseTimer)
  releaseTimer = undefined
  if (!ipc) {
    // 没有连接就没有会话，脏标记可以安全丢弃
    recoSessionDirty = false
    return true
  }
  try {
    await ipc.releaseRecoSession()
    recoSessionDirty = false
    return true
  } catch (err) {
    // 释放失败时保留脏标记，下一次识别前会再试一次，避免继续用旧资源
    logger.warn(`release quick reco session failed: ${err}`)
    return false
  }
}

/** 有连接时释放；没有连接就不为此拉起 server */
function releaseCachedRecoSession() {
  // 面板关闭时也要取消待触发的合并释放，否则它可能在重开面板后打掉刚建好的会话
  clearTimeout(releaseTimer)
  releaseTimer = undefined
  if (!serverService.rpc.conn) {
    recoSessionDirty = false
    return
  }
  void releaseRecoSession(serverService.ipc)
}

/** 编辑 pipeline/模板时变更事件密集到达，合并成一次释放 */
function scheduleReleaseRecoSession() {
  recoSessionDirty = true
  clearTimeout(releaseTimer)
  releaseTimer = setTimeout(() => {
    releaseTimer = undefined
    releaseCachedRecoSession()
  }, 500)
}

export class WebviewCropPanel extends WebviewPanelProvider<CropHostToWeb, CropWebToHost> {
  ipc: IpcType
  private configChangedDisposable: vscode.Disposable
  /** interface / pipeline / 资源变更后快速识别的缓存已过期，需要释放会话让它下次重建 */
  private sessionReleaseDisposables: vscode.Disposable[]
  private disposed: boolean

  constructor(ipc: IpcType, title: string, viewColumn?: vscode.ViewColumn) {
    super({
      context,
      folder: 'webview',
      index: 'crop',
      webId: 'maa.view.crop',
      title,
      viewColumn: viewColumn ?? vscode.ViewColumn.Active,
      preserveFocus: false,
      iconPath: 'images/logo.png',
      dev: isCropDev
    })

    this.ipc = ipc
    this.disposed = false
    openCropPanels += 1
    this.configChangedDisposable = vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('maa.webviewTooltipDisabled')) {
        this.pushState()
      }
    })

    // 快速识别会缓存资源与 agent；pipeline/interface/资源变化后缓存必须失效，
    // 否则用户改完节点再点识别仍用旧定义，Custom 需求也可能漏判
    this.sessionReleaseDisposables = [
      interfaceService.onInterfaceChanged(scheduleReleaseRecoSession),
      interfaceService.onInterfaceImportChanged(scheduleReleaseRecoSession),
      interfaceService.onPipelineChanged(scheduleReleaseRecoSession),
      interfaceService.onResourceChanged(scheduleReleaseRecoSession)
    ]
  }

  dispose() {
    // 面板计数只能减一次，重复调用时直接返回
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.configChangedDisposable.dispose()
    for (const disposable of this.sessionReleaseDisposables) {
      disposable.dispose()
    }
    openCropPanels = Math.max(openCropPanels - 1, 0)
    if (openCropPanels === 0) {
      // 面板全部关闭后释放快速识别会话，避免 agent 子进程一直挂着
      releaseCachedRecoSession()
    }
    console.log('crop panel dispose')
  }

  /**
   * 面板比 maa-server 连接活得久（重启 server 不会关闭裁剪面板），构造时拿到的 ipc 可能已失效；
   * 每次请求都取当前连接，必要时重新拉起 server。
   */
  private async currentIpc(): Promise<IpcType> {
    return (await serverService.ensureServer()) ?? this.ipc
  }

  /**
   * 一次性识别（快速识别）用到的 agent 上下文。非 MAA 模式下由 interface 声明解析，
   * 没有 controller/设备时也能取到；MAA 模式不支持 Custom，直接不传。
   */
  private async buildAgentSetup(): Promise<ToolAgentSetup | null> {
    if (isMaaAssistantArknights) {
      return null
    }
    const agentRuntime = await interfaceService.buildAgentRuntime()
    if (!agentRuntime) {
      return null
    }
    const timeout =
      (vscode.workspace.getConfiguration('maa').get('agentTimeout') as number | undefined) ?? 30000
    return {
      root: agentRuntime.root,
      resources: agentRuntime.resources,
      agents: agentRuntime.agents,
      timeout
    }
  }

  /** 把 maa-server 返回的结构化失败转换成宿主语言的文案 */
  private localizeFailure(failure: ToolFailure): string {
    switch (failure.kind) {
      case 'no-agent':
        return t('maa.crop.reco.failure.no-agent', failure.names.join(', '))
      case 'unregistered':
        return t('maa.crop.reco.failure.unregistered', failure.names.join(', '))
      case 'agent-exited':
        return t('maa.crop.reco.failure.agent-exited', failure.names.join(', '))
      case 'agent-start-failed':
        return t('maa.crop.reco.failure.agent-start-failed', failure.target)
      case 'agent-in-use':
        return t('maa.crop.reco.failure.agent-in-use', failure.identifiers.join(', '))
      case 'busy':
        return t('maa.crop.reco.failure.busy')
      case 'internal': {
        // 协议固定标签 → 宿主文案；新增标签时 Record 的类型会强制这里补齐
        const internalKeys: Record<ToolInternalTag, Parameters<typeof t>[0]> = {
          'no-resource': 'maa.crop.reco.failure.no-resource',
          ipc: 'maa.crop.reco.failure.ipc',
          'resource-load-failed': 'maa.crop.reco.failure.resource-load-failed',
          'controller-create-failed': 'maa.crop.reco.failure.controller-create-failed',
          'tasker-create-failed': 'maa.crop.reco.failure.tasker-create-failed',
          'scan-failed': 'maa.crop.reco.failure.scan-failed',
          'invalid-options': 'maa.crop.reco.failure.invalid-options',
          'custom-recognition-failed': 'maa.crop.reco.failure.custom-recognition-failed',
          'internal-error': 'maa.crop.reco.failure.internal-error'
        }
        return t(internalKeys[failure.tag])
      }
    }
  }

  private localizeToolResult(result: ToolResult) {
    return {
      detail: result.detail,
      failure: result.failure ? { message: this.localizeFailure(result.failure) } : undefined
    }
  }

  /**
   * 保存结果相对资源 image 目录的路径。
   * pipeline 的 `template` 是相对 image 根解析的，不能用相对 resource 根的路径；
   * 保存到自定义目录（不在 image 目录下）时返回 null，不提供片段复制。
   */
  private templateRelativePath(resultPath: vscode.Uri): string | null {
    const resource = interfaceService.suggestResource()
    if (!resource) {
      return null
    }
    const imageRoot = vscode.Uri.joinPath(resource, imageSuffix).fsPath
    const relative = path.relative(imageRoot, resultPath.fsPath)
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      return null
    }
    return relative.split(path.sep).join('/')
  }

  async recv(data: WebToHost<CropWebToHost>) {
    switch (data.command) {
      case '__init':
        this.pushState()
        break
      case 'requestScreencap': {
        if (!rootService.activeResource) {
          this.response(data.seq, {
            image: null,
            failure: { message: t('maa.crop.common.failure.no-resource') }
          })
          break
        }
        try {
          if (!(await launchService.updateCache())) {
            this.response(data.seq, {
              image: null,
              failure: { message: t('maa.crop.common.failure.controller') }
            })
            break
          }
          const image = await (await this.currentIpc()).getScreencap()
          if (!image) {
            this.response(data.seq, {
              image: null,
              failure: { message: t('maa.crop.screencap.failure.capture') }
            })
            break
          }
          this.response(data.seq, { image: 'data:image/png;base64,' + image })
        } catch (err) {
          logger.error(`screencap failed, error ${err}`)
          this.response(data.seq, {
            image: null,
            failure: { message: t('maa.crop.common.failure.ipc') }
          })
        }
        break
      }
      case 'requestUpload': {
        const options: vscode.OpenDialogOptions = {
          canSelectMany: false,
          openLabel: 'Upload',
          filters: {
            Images: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif']
          },
          defaultUri: stateService.state.uploadDir
            ? vscode.Uri.file(stateService.state.uploadDir)
            : undefined
        }

        const files = await vscode.window.showOpenDialog(options)
        if (!files || files.length === 0) {
          this.response(data.seq, null)
          break
        }

        stateService.reduce({
          uploadDir: path.dirname(files[0].fsPath)
        })

        try {
          this.response(data.seq, {
            image: toPngDataUrl(await vscode.workspace.fs.readFile(files[0]))
          })
        } catch (err) {
          logger.error(`upload failed, error ${err}`)
          this.response(data.seq, {
            image: null,
            failure: { message: t('maa.crop.upload.failure.read') }
          })
        }
        break
      }
      case 'requestSave': {
        try {
          const image = Buffer.from(data.image.replace('data:image/png;base64,', ''), 'base64')
          const jimpImage = await Jimp.read(image)
          jimpImage.crop({
            x: data.crop[0],
            y: data.crop[1],
            w: data.crop[2],
            h: data.crop[3]
          })
          const finalImage = await jimpImage.getBuffer('image/png')

          const saveDir = stateService.state.cropSettings?.saveDir
          const resource = interfaceService.suggestResource()
          if (!resource) {
            vscode.window.showWarningMessage(t('maa.crop.warning.no-resource'))
            const path = await vscode.window.showSaveDialog({
              filters: {
                Png: ['png']
              },
              defaultUri: saveDir
                ? vscode.Uri.file(saveDir)
                : (rootService.activeResource?.workspace ?? undefined)
            })
            if (!path) {
              this.response(data.seq, null)
              break
            }
            await vscode.workspace.fs.writeFile(path, finalImage)
            this.response(data.seq, { path: path.fsPath, relativePath: null })
            break
          }
          const targetDir = saveDir
            ? vscode.Uri.file(saveDir)
            : vscode.Uri.joinPath(resource, imageSuffix)
          // 导出面板已命名时直接用（过滤文件名非法字符）；否则沿用输入框
          const asked =
            data.filename?.trim().replace(/[\\/:*?"<>|]/g, '') ||
            (await vscode.window.showInputBox({
              title: t('maa.pi.title.input-image'),
              ignoreFocusOut: true
            }))
          const name = asked?.trim()
          if (!name) {
            this.response(data.seq, null)
            break
          }
          const resultPath = vscode.Uri.joinPath(
            targetDir,
            stateService.state.cropSettings?.saveAddRoiInfo
              ? `${name}__${data.roi.join('_')}__${data.expandRoi.join('_')}.png`
              : `${name}.png`
          )
          await vscode.workspace.fs.writeFile(resultPath, finalImage)
          const relativePath = this.templateRelativePath(resultPath)
          if (relativePath) {
            // 刚写掉的是资源里的模板：缓存会话可能已把同名图片解码进内存，立刻置脏，
            // 保存后直接点识别也不会命中旧图（文件监听的 100ms 合并窗口还没到）
            recoSessionDirty = true
          }
          // 不自动 revealInExplorer：避免保存后抢走焦点，由 webview 的「打开所在文件夹」显式触发
          this.response(data.seq, {
            path: resultPath.fsPath,
            relativePath
          })
        } catch (err) {
          logger.error(`save failed, error ${err}`)
          this.response(data.seq, {
            path: null,
            failure: { message: t('maa.crop.save.failure.failed', `${err}`) }
          })
        }
        break
      }
      case 'requestPickFolder': {
        const saveDir = stateService.state.cropSettings?.saveDir
        const resource = interfaceService.suggestResource()
        const defaultUri = saveDir
          ? vscode.Uri.file(saveDir)
          : resource
            ? vscode.Uri.joinPath(resource, imageSuffix)
            : rootService.activeResource?.workspace
        const folders = await vscode.window.showOpenDialog({
          canSelectFolders: true,
          canSelectFiles: false,
          canSelectMany: false,
          openLabel: 'Select Folder',
          defaultUri
        })
        if (!folders || folders.length === 0) {
          this.response(data.seq, null)
          break
        }
        this.response(data.seq, folders[0]!.fsPath)
        break
      }
      case 'resize': {
        let result: string | null = null
        try {
          result = await (
            await this.currentIpc()
          ).resize(data.image.replace('data:image/png;base64,', ''), data.width, data.height)
        } catch (err) {
          logger.error(`resize failed, error ${err}`)
        }
        // 必须回包：webview 的 call 没有超时，不回应会让「缩放」按钮一直转圈
        this.response(data.seq, result ? 'data:image/png;base64,' + result : null)
        break
      }
      case 'requestOCR': {
        const resources = interfaceService.resourcePaths
        if (!resources.length) {
          this.response(data.seq, {
            detail: null,
            failure: { message: t('maa.crop.common.failure.no-resource') }
          })
          break
        }
        let result = null
        let failed = false
        try {
          result = await (
            await this.currentIpc()
          ).performOcr(
            isMaaAssistantArknights,
            data.image.replace('data:image/png;base64,', ''),
            {
              roi: data.roi,
              only_rec: data.only_rec
            },
            resources.map(u => u.fsPath)
          )
        } catch (err) {
          failed = true
          logger.error(`ocr failed, error ${err}`)
        }
        if (failed) {
          this.response(data.seq, {
            detail: null,
            failure: { message: t('maa.crop.common.failure.ipc') }
          })
        } else if (result === null) {
          this.response(data.seq, {
            detail: null,
            failure: { message: t('maa.crop.ocr.failure.failed') }
          })
        } else {
          this.response(data.seq, { detail: result })
        }
        break
      }
      case 'requestTemplateMatch': {
        const targetPath = await vscode.window.showOpenDialog({
          filters: {
            Images: ['png']
          },
          defaultUri: stateService.state.uploadDir
            ? vscode.Uri.file(stateService.state.uploadDir)
            : undefined
        })
        if (!targetPath || targetPath.length !== 1) {
          this.response(data.seq, null)
          return null
        }

        stateService.reduce({
          uploadDir: path.dirname(targetPath[0].fsPath)
        })

        let target: Buffer
        try {
          target = await fs.readFile(targetPath[0].fsPath)
        } catch (err) {
          logger.error(`read template failed, error ${err}`)
          this.response(data.seq, {
            detail: null,
            failure: { message: t('maa.crop.upload.failure.read') }
          })
          break
        }

        let result = null
        let failed = false
        try {
          result = await (
            await this.currentIpc()
          ).performTemplateMatch(
            data.image.replace('data:image/png;base64,', ''),
            target.toString('base64'),
            {
              roi: data.roi,
              method: data.method,
              threshold: data.threshold,
              green_mask: data.green_mask
            }
          )
        } catch (err) {
          failed = true
          logger.error(`tmpl match failed, error ${err}`)
        }
        if (failed) {
          this.response(data.seq, {
            detail: null,
            failure: { message: t('maa.crop.common.failure.ipc') }
          })
        } else if (result === null) {
          this.response(data.seq, {
            detail: null,
            failure: { message: t('maa.crop.template.failure.failed') }
          })
        } else {
          this.response(data.seq, { detail: result })
        }
        break
      }
      case 'requestReco': {
        const resources = interfaceService.resourcePaths
        if (!resources.length) {
          this.response(data.seq, {
            detail: null,
            failure: { message: t('maa.crop.reco.failure.no-resource') }
          })
          break
        }
        let result: ToolResult | null = null
        let failed = false
        try {
          const ipc = await this.currentIpc()
          // 变更事件与点击可能落在同一个 500ms 合并窗口里：识别前先把旧会话释放掉，
          // 否则本次识别仍会命中变更前的 pipeline/模板缓存。释放失败也不能继续，
          // 用旧定义识别出的结果用户分辨不出来，直接按 IPC 失败处理
          if (recoSessionDirty && !(await releaseRecoSession(ipc))) {
            this.response(data.seq, {
              detail: null,
              failure: { message: t('maa.crop.reco.failure.ipc') }
            })
            break
          }
          result = await ipc.performReco(
            data.image.replace('data:image/png;base64,', ''),
            resources.map(u => u.fsPath),
            (await this.buildAgentSetup()) ?? undefined,
            data.roi
          )
        } catch (err) {
          failed = true
          logger.error(`reco failed, error ${err}`)
        }
        if (failed) {
          this.response(data.seq, {
            detail: null,
            failure: { message: t('maa.crop.reco.failure.ipc') }
          })
        } else if (result === null) {
          // null = 用户取消了节点选择，交给 webview 静默处理
          this.response(data.seq, null)
        } else {
          this.response(data.seq, this.localizeToolResult(result))
        }
        break
      }
      case 'requestColorMatch': {
        let result: ToolResult | null = null
        try {
          result = await (
            await this.currentIpc()
          ).performColorMatch(data.image.replace('data:image/png;base64,', ''), data.options)
        } catch (err) {
          logger.error(`color match failed, error ${err}`)
        }
        if (result === null) {
          this.response(data.seq, {
            detail: null,
            failure: { message: t('maa.crop.reco.failure.ipc') }
          })
        } else {
          this.response(data.seq, this.localizeToolResult(result))
        }
        break
      }
      case 'requestReveal': {
        const target = vscode.Uri.file(data.path)
        // revealInExplorer 只能定位工作区内的文件；自定义保存目录/另存为可能在工作区外，改用系统文件管理器
        const command = vscode.workspace.getWorkspaceFolder(target)
          ? 'revealInExplorer'
          : 'revealFileInOS'
        try {
          await vscode.commands.executeCommand(command, target)
        } catch (err) {
          logger.warn(`reveal ${data.path} failed: ${err}`)
        }
        break
      }
      case 'writeClipboard':
        vscode.env.clipboard.writeText(data.text)
        break
      case 'readClipboard':
        this.response(data.seq, await vscode.env.clipboard.readText())
        break
      case 'updateSettings':
        stateService.reduce({
          cropSettings: {
            ...stateService.state.cropSettings,
            [data.key]: data.value
          }
        })
        this.pushState()
        break
    }
    if (data.builtin) {
      super.recv(data)
    }
  }

  get state(): CropHostState {
    return {
      isMAA: isMaaAssistantArknights,
      fwStatus: nativeService.currentVersionInfo,
      locale,

      ...stateService.state.cropSettings,
      tooltipDisabled: getTooltipDisabled()
    }
  }

  pushState() {
    this.send({
      command: 'updateState',
      state: this.state
    })
  }
}
