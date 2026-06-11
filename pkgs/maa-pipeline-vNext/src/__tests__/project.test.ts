import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'

import { FsContentLoader } from '../io/fs/loader'
import { nodePathUtils } from '../path/node'
import { Project } from '../project/project'
import { Snapshot } from '../snapshot/snapshot'
import type { TaskName } from '../types'

async function tempDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'maa-pipeline-test-'))
}

async function writeFile(dir: string, relPath: string, content: string): Promise<void> {
  const fullPath = path.join(dir, relPath)
  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.writeFile(fullPath, content, 'utf8')
}

async function setupProject(dir: string): Promise<void> {
  // interface.json
  await writeFile(
    dir,
    'interface.json',
    JSON.stringify({
      controller: [{ name: 'TestCtrl', type: 'Adb' }],
      resource: [{ name: 'Official', path: 'resource' }],
      task: [{ name: 'MainTask', entry: 'Start' }]
    })
  )

  // resource/default_pipeline.json
  // 按照 MaaFramework 协议，default_pipeline 为任务提供默认参数
  //（rate_limit、pre_delay、post_delay、timeout 等），不提供 recognition/action 类型默认值
  // "Default" key 表示适用于所有任务
  await writeFile(
    dir,
    'resource/default_pipeline.json',
    JSON.stringify({
      Default: {
        rate_limit: 1000,
        pre_delay: 200,
        post_delay: 200,
        timeout: 5000
      }
    })
  )

  // resource/pipeline/Main.json
  await writeFile(
    dir,
    'resource/pipeline/Main.json',
    JSON.stringify({
      Start: {
        action: 'Click',
        next: ['Step1', 'Step2']
      },
      Step1: {
        recognition: 'TemplateMatch',
        template: 'step1.png',
        action: 'Click',
        next: ['End']
      },
      Step2: {
        recognition: 'TemplateMatch',
        template: 'step2.png',
        action: 'Click',
        next: ['End']
      },
      End: {
        action: 'DoNothing'
      }
    })
  )

  // Create some image files (empty)
  await writeFile(dir, 'resource/image/step1.png', '')
  await writeFile(dir, 'resource/image/step2.png', '')
  await writeFile(dir, 'resource/image/sub/icon.png', '')
}

describe('Project', () => {
  it('loads interface and bundles end-to-end', async () => {
    const dir = await tempDir()
    try {
      await setupProject(dir)

      const loader = new FsContentLoader()
      const project = new Project(loader, nodePathUtils, false, dir)

      await project.loadInterface()
      expect(project.parsedInterface).not.toBeNull()
      expect(project.parsedInterface!.data.controller['TestCtrl']).toBeDefined()

      await project.switchActive('TestCtrl', 'Official')
      expect(project.snapshot).not.toBeNull()

      const snap = project.getSnapshot()!
      expect(snap.bundles).toHaveLength(2)

      const bundle = snap.bundles[0]
      expect(bundle.files.size).toBeGreaterThan(0)
      expect(bundle.images.size).toBe(3) // step1.png, step2.png, sub/icon.png
      expect(bundle.defaultConfig).not.toBeNull()

      // Check parsed pipeline content
      const tasks = Snapshot.listTasks(snap)
      expect(tasks).toContain('Start')
      expect(tasks).toContain('Step1')
      expect(tasks).toContain('End')

      // Check default config
      if (bundle.defaultConfig) {
        expect(bundle.defaultConfig.has('$Default' as TaskName)).toBe(true)
      }
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('handles empty resource gracefully', async () => {
    const dir = await tempDir()
    try {
      await writeFile(
        dir,
        'interface.json',
        JSON.stringify({
          controller: [{ name: 'Ctrl', type: 'Adb' }],
          resource: [{ name: 'Empty', path: [] }]
        })
      )

      const loader = new FsContentLoader()
      const project = new Project(loader, nodePathUtils, false, dir)

      await project.loadInterface()
      await project.switchActive('Ctrl', 'Empty')

      expect(project.snapshot).not.toBeNull()
      expect(project.getSnapshot()!.bundles).toHaveLength(1)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('loads with import files', async () => {
    const dir = await tempDir()
    try {
      await writeFile(
        dir,
        'interface.json',
        JSON.stringify({
          controller: [{ name: 'Ctrl', type: 'Win32' }],
          resource: [{ name: 'Res', path: [] }],
          import: ['import_tasks.json']
        })
      )

      await writeFile(
        dir,
        'import_tasks.json',
        JSON.stringify({
          task: [{ name: 'ImportedTask', entry: 'Begin' }],
          option: {
            ImportedOpt: {
              type: 'select',
              cases: [{ name: 'case1' }, { name: 'case2' }]
            }
          }
        })
      )

      const loader = new FsContentLoader()
      const project = new Project(loader, nodePathUtils, false, dir)

      await project.loadInterface()
      expect(project.parsedInterface).not.toBeNull()

      const iface = project.parsedInterface!
      // Imported tasks should be merged
      expect(iface.data.task['ImportedTask']).toBeDefined()
      expect(iface.data.option['ImportedOpt']).toBeDefined()
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('reloads from disk', async () => {
    const dir = await tempDir()
    try {
      await writeFile(
        dir,
        'interface.json',
        JSON.stringify({
          controller: [{ name: 'Ctrl', type: 'Adb' }],
          resource: [{ name: 'Res', path: [] }]
        })
      )

      const loader = new FsContentLoader()
      const project = new Project(loader, nodePathUtils, false, dir)

      await project.loadInterface()
      expect(project.parsedInterface!.data.controller['Ctrl']).toBeDefined()

      // Modify the file
      await writeFile(
        dir,
        'interface.json',
        JSON.stringify({
          controller: [{ name: 'Ctrl2', type: 'Win32' }],
          resource: [{ name: 'Res', path: [] }]
        })
      )

      await project.reload()
      expect(project.parsedInterface!.data.controller['Ctrl2']).toBeDefined()
      expect(project.parsedInterface!.data.controller['Ctrl']).toBeUndefined()
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('throws for missing interface file', async () => {
    const dir = await tempDir()
    try {
      const loader = new FsContentLoader()
      const project = new Project(loader, nodePathUtils, false, dir)

      await expect(project.loadInterface()).rejects.toThrow('Cannot read interface file')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('handles MAA mode bundle paths', async () => {
    const dir = await tempDir()
    try {
      await writeFile(
        dir,
        'interface.json',
        JSON.stringify({
          controller: [{ name: 'Ctrl', type: 'Adb' }],
          resource: [{ name: 'Res', path: 'maa_resource' }]
        })
      )

      await writeFile(
        dir,
        'maa_resource/tasks/MainTask.json',
        JSON.stringify({
          Start: { action: 'Click', next: ['End'] },
          End: { action: 'DoNothing' }
        })
      )

      const loader = new FsContentLoader()
      const project = new Project(loader, nodePathUtils, true, dir)

      await project.loadInterface()
      await project.switchActive('Ctrl', 'Res')

      const snap = project.getSnapshot()!
      expect(snap.bundles).toHaveLength(2)
      expect(snap.bundles[0].files.size).toBeGreaterThan(0)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
