/**
 * MaaEnd 临时测试脚本
 *
 * 用法：npx tsx scripts/test-maaend.ts [MaaEnd assets 目录路径]
 */
import { performDiagnostic } from '../src/diagnostic'
import { FsContentLoader } from '../src/io/fs/loader'
import { nodePathUtils } from '../src/path/node'
import { Project } from '../src/project/project'
import { Snapshot } from '../src/snapshot/snapshot'

async function main() {
  const assetsPath = process.argv[2]
  if (!assetsPath) {
    console.error('Usage: npx tsx scripts/test-maaend.ts <path-to-assets>')
    process.exit(1)
  }

  console.log('═'.repeat(60))
  console.log(`MaaEnd Pipeline Test`)
  console.log(`Assets: ${assetsPath}`)
  console.log('═'.repeat(60))

  const loader = new FsContentLoader()
  const project = new Project(loader, nodePathUtils, false, assetsPath)

  // 1. 加载 interface.json
  console.log('\n[1] Loading interface.json...')
  const t0 = Date.now()
  await project.loadInterface()
  console.log(`    Done in ${Date.now() - t0}ms`)

  const iface = project.parsedInterface!
  console.log(`    Controllers: ${Object.keys(iface.data.controller).join(', ')}`)
  console.log(`    Resources:   ${Object.keys(iface.data.resource).join(', ')}`)
  console.log(`    Tasks:       ${Object.keys(iface.data.task).length}`)
  console.log(`    Options:     ${Object.keys(iface.data.option).length}`)
  console.log(`    Imports:     ${(iface.data.import ?? []).length}`)

  // 2. 加载第一个 resource 的所有 Bundle
  const firstRes = Object.keys(iface.data.resource)[0]
  const firstCtrl = Object.keys(iface.data.controller)[0]
  console.log(`\n[2] Loading bundles for resource="${firstRes}"...`)
  const t1 = Date.now()
  await project.switchActive(firstCtrl, firstRes)
  console.log(`    Done in ${Date.now() - t1}ms`)

  const initialSnap = project.getSnapshot()!
  console.log(`    Bundles: ${initialSnap.bundles.length}`)
  for (const b of initialSnap.bundles) {
    console.log(`      ${b.root}`)
    console.log(
      `        files: ${b.files.size}, images: ${b.images.size}, defaultConfig: ${b.defaultConfig !== null}`
    )
  }

  // 3. Snapshot
  const snap = project.getSnapshot()!
  const tasks = Snapshot.listTasks(snap)
  const decls = Snapshot.allDecls(snap)
  const refs = Snapshot.allRefs(snap)
  const images = Snapshot.listImages(snap)

  console.log(`\n[3] Snapshot:`)
  console.log(`    Tasks:  ${tasks.length}`)
  console.log(`    Decls:  ${decls.length}`)
  console.log(`    Refs:   ${refs.length}`)
  console.log(`    Images: ${images.length}`)

  // 4. Diagnostics
  console.log(`\n[4] Running diagnostics...`)
  const t2 = Date.now()
  const diags = performDiagnostic(snap)
  console.log(`    Done in ${Date.now() - t2}ms`)
  console.log(`    Total diagnostics: ${diags.length}`)

  const byLevel = { error: 0, warning: 0 }
  const byType = new Map<string, number>()
  for (const d of diags) {
    byLevel[d.level] = (byLevel[d.level] ?? 0) + 1
    byType.set(d.type, (byType.get(d.type) ?? 0) + 1)
  }
  console.log(`    Errors:   ${byLevel.error}`)
  console.log(`    Warnings: ${byLevel.warning}`)
  console.log(`    By type:`)
  for (const [type, count] of [...byType.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`      ${type}: ${count}`)
  }

  // 5. 打印一些具体的诊断信息
  if (diags.length > 0) {
    console.log(`\n[5] Sample diagnostics (first 10):`)
    for (const d of diags.slice(0, 10)) {
      console.log(`    [${d.level}] ${d.type}`)
    }
  }

  console.log('\n' + '═'.repeat(60))
  console.log('Test completed successfully.')
  console.log('═'.repeat(60))
}

main().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
