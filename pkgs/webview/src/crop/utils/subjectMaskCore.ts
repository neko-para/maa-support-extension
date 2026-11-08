/**
 * 「圈选主体 + 颜色模型」生成绿幕的核心算法（纯函数，可单测）。
 * 输入：ROI 的 RGBA 数据 + 手画区域 mask（1=区域内的主体候选）；
 * 输出：绿幕 mask（1=背景，需要涂绿；0=主体，保留）。
 *
 * 思路：以圈选区域为硬约束，用「区域内颜色」和「区域外一圈颜色」分别建
 * 前景/背景颜色模型，逐像素按最近颜色模型分类；再去掉碎片连通域并填洞。
 * 不依赖 OpenCV。
 */
export type SubjectMaskOptions = {
  /** 区域外扩多少像素作为背景样本环（默认 4） */
  ring?: number
  /** 每侧颜色聚类数（默认 6） */
  clusters?: number
  /** 主体判定偏置，>1 更倾向保留主体（默认 1.1，UI 滑杆 0.5–3） */
  bias?: number
  /**
   * 圈选边界向最近强边缘吸附的半径像素数（默认 10，0 关闭）。
   * 手画圈选普遍比主体大一圈：逐层腐蚀弱边缘像素直到命中梯度边缘或用尽半径，
   * 圈出的方角/富余边会被收贴到主体真实轮廓。
   */
  snap?: number
  /**
   * 圈选内的「排除圈」mask（1=强制当背景）：用户在圈内补画的小区域，
   * 其中像素不进前景模型、直接判背景。用于剔除镜面色块/同色碎片。
   */
  exclude?: Uint8Array
  /**
   * 连通域至少要达到最大连通域的多大比例才保留（默认 0.02）。
   * 文字、角标等主体由多个分离部件组成，不能只留最大的一块。
   */
  minComponentRatio?: number
}

export type SubjectMaskResult = {
  /** 1 = 背景（涂绿），0 = 主体（保留） */
  mask: Uint8Array
  width: number
  height: number
  subjectPixels: number
  backgroundPixels: number
  /** 用于背景模型的采样像素数（过少时 UI 应提示圈选方式不合适） */
  backgroundSamples: number
  /** 分类用的背景容差（中位数×2，下限 16） */
  bgTolerance: number
  /** 参与前景模型聚类的采样像素数；≈0 说明圈内颜色都像背景，是「主体≈0」的信号 */
  foregroundSamples: number
}

type Color = [number, number, number]

function dilate(mask: Uint8Array, width: number, radius: number) {
  let current = mask
  for (let round = 0; round < radius; round++) {
    const next = current.slice()
    for (let idx = 0; idx < current.length; idx++) {
      if (current[idx] !== 1) {
        continue
      }
      const x = idx % width
      if (x > 0) {
        next[idx - 1] = 1
      }
      if (x < width - 1) {
        next[idx + 1] = 1
      }
      if (idx >= width) {
        next[idx - width] = 1
      }
      if (idx < current.length - width) {
        next[idx + width] = 1
      }
    }
    current = next
  }
  return current
}

/** 灰度梯度幅值（3x3 Sobel 近似，0–255）；边缘像素用单向差分 */
function gradientMap(data: Uint8ClampedArray, width: number, height: number): Float32Array {
  const gray = new Float32Array(width * height)
  for (let i = 0; i < width * height; i++) {
    const o = i * 4
    gray[i] = (data[o]! * 299 + data[o + 1]! * 587 + data[o + 2]! * 114) / 1000
  }
  const grad = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const gx =
        x > 0 && x < width - 1
          ? (gray[y * width + x + 1]! - gray[y * width + x - 1]!) / 2
          : x < width - 1
            ? gray[y * width + x + 1]! - gray[y * width + x]!
            : gray[y * width + x]! - gray[y * width + x - 1]!
      const gy =
        y > 0 && y < height - 1
          ? (gray[(y + 1) * width + x]! - gray[(y - 1) * width + x]!) / 2
          : y < height - 1
            ? gray[(y + 1) * width + x]! - gray[y * width + x]!
            : gray[y * width + x]! - gray[(y - 1) * width + x]!
      grad[y * width + x] = Math.sqrt(gx * gx + gy * gy)
    }
  }
  return grad
}

/**
 * 边界吸附：把 region 向内腐蚀，直到每个边界像素贴近强梯度边缘（沿腐蚀路径命中或
 * 1px 邻域内有强边缘）。超过 radius 仍未命中就保持腐蚀后的位置——圈选
 * 大于主体的方角会被继续收进去，不再退回原始圈选。
 */
function snapToEdges(
  region: Uint8Array,
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
): Uint8Array {
  const grad = gradientMap(data, width, height)
  const STRONG = 24
  const strong = new Uint8Array(width * height)
  for (let i = 0; i < grad.length; i++) {
    if (grad[i]! >= STRONG) {
      strong[i] = 1
    }
  }

  const result = region.slice()
  for (let round = 0; round < radius; round++) {
    const weak: number[] = []
    let count = 0
    for (let idx = 0; idx < result.length; idx++) {
      if (result[idx] !== 1) {
        continue
      }
      count += 1
      const x = idx % width
      const y = Math.floor(idx / width)
      const onBoundary =
        x === 0 ||
        x === width - 1 ||
        y === 0 ||
        y === height - 1 ||
        result[idx - 1] !== 1 ||
        result[idx + 1] !== 1 ||
        result[idx - width] !== 1 ||
        result[idx + width] !== 1
      if (!onBoundary) {
        continue
      }
      // 本像素或 4 邻域有强边缘 → 已贴边，不再腐蚀
      const touching =
        strong[idx] === 1 ||
        (x > 0 && strong[idx - 1] === 1) ||
        (x < width - 1 && strong[idx + 1] === 1) ||
        (y > 0 && strong[idx - width] === 1) ||
        (y < height - 1 && strong[idx + width] === 1)
      if (!touching) {
        weak.push(idx)
      }
    }
    if (weak.length === 0 || weak.length === count) {
      break
    }
    for (const idx of weak) {
      result[idx] = 0
    }
  }
  return result
}

function collectColors(data: Uint8ClampedArray, mask: Uint8Array, maxSamples = 8000): Color[] {
  let count = 0
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 1) {
      count += 1
    }
  }
  if (count === 0) {
    return []
  }
  const stride = Math.max(1, Math.floor(count / maxSamples))
  const colors: Color[] = []
  let seen = 0
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] !== 1) {
      continue
    }
    seen += 1
    if (seen % stride !== 0) {
      continue
    }
    const idx = i * 4
    colors.push([data[idx]!, data[idx + 1]!, data[idx + 2]!])
  }
  return colors
}

/** 确定性 K-means：按亮度排序后等距初始化，避免随机导致结果不稳定 */
function clusterColors(samples: Color[], k: number): Color[] {
  if (samples.length === 0) {
    return []
  }
  const count = Math.min(k, samples.length)
  const sorted = [...samples].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]))
  let means: Color[] = Array.from({ length: count }, (_, i) => {
    const sample = sorted[Math.floor(((i + 0.5) / count) * sorted.length)] ?? sorted[0]!
    return [sample[0], sample[1], sample[2]] as Color
  })

  for (let iter = 0; iter < 6; iter++) {
    const sums = means.map(() => [0, 0, 0])
    const counts = means.map(() => 0)
    for (const sample of samples) {
      let best = 0
      let bestDist = Infinity
      for (let idx = 0; idx < means.length; idx++) {
        const mean = means[idx]!
        const dr = sample[0] - mean[0]
        const dg = sample[1] - mean[1]
        const db = sample[2] - mean[2]
        const dist = dr * dr + dg * dg + db * db
        if (dist < bestDist) {
          bestDist = dist
          best = idx
        }
      }
      sums[best]![0]! += sample[0]
      sums[best]![1]! += sample[1]
      sums[best]![2]! += sample[2]
      counts[best]! += 1
    }
    means = means.map((mean, idx) => {
      const sum = sums[idx]!
      const size = counts[idx]!
      if (size === 0) {
        return mean
      }
      return [sum[0]! / size, sum[1]! / size, sum[2]! / size] as Color
    })
  }
  return means
}

function nearestDistance(color: Color, means: Color[]) {
  let best = Infinity
  for (const mean of means) {
    const dr = color[0] - mean[0]
    const dg = color[1] - mean[1]
    const db = color[2] - mean[2]
    const dist = Math.sqrt(dr * dr + dg * dg + db * db)
    if (dist < best) {
      best = dist
    }
  }
  return best
}

/**
 * 去掉主体 mask 中的碎片：面积不到最大 8 连通域 `minRatio` 倍的连通域判为背景。
 * 这类碎片通常是颜色接近主体的噪点；体量相当的分离部件（文字笔画、角标）会被保留。
 */
function removeSmallComponents(
  subject: Uint8Array,
  width: number,
  height: number,
  minRatio: number
) {
  const label = new Int32Array(subject.length)
  const sizes: number[] = [0]
  const queue = new Int32Array(subject.length)
  for (let start = 0; start < subject.length; start++) {
    if (subject[start] !== 1 || label[start] !== 0) {
      continue
    }
    const id = sizes.length
    let head = 0
    let tail = 0
    queue[tail++] = start
    label[start] = id
    while (head < tail) {
      const idx = queue[head++]!
      const x = idx % width
      const y = Math.floor(idx / width)
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= height) {
          continue
        }
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          if ((dx === 0 && dy === 0) || nx < 0 || nx >= width) {
            continue
          }
          const next = ny * width + nx
          if (subject[next] === 1 && label[next] === 0) {
            label[next] = id
            queue[tail++] = next
          }
        }
      }
    }
    sizes.push(tail)
  }

  let largest = 0
  for (const size of sizes) {
    largest = Math.max(largest, size)
  }
  if (largest === 0) {
    return
  }
  const minSize = largest * minRatio
  for (let idx = 0; idx < subject.length; idx++) {
    if (subject[idx] === 1 && sizes[label[idx]!]! < minSize) {
      subject[idx] = 0
    }
  }
}

/**
 * 填充主体内部的小洞（被主体包围的背景像素视为主体，例如手柄上的彩色按钮）。
 * 洞逐个洪泛并限量：比主体总面积还大的一半就算「分离部件围出的内凹背景」，
 * 不是洞，保持背景（main + 分离小部件之间的空地不应被填）。
 */
function fillHoles(subject: Uint8Array, width: number, height: number) {
  let subjectCount = 0
  for (let i = 0; i < subject.length; i++) {
    if (subject[i] === 1) {
      subjectCount += 1
    }
  }
  const maxHole = Math.max(1, Math.floor(subjectCount / 2))

  const reachable = new Uint8Array(subject.length)
  const queue = new Int32Array(subject.length)
  let head = 0
  let tail = 0
  const push = (idx: number) => {
    if (subject[idx] === 0 && reachable[idx] === 0) {
      reachable[idx] = 1
      queue[tail++] = idx
    }
  }
  for (let x = 0; x < width; x++) {
    push(x)
    push((height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    push(y * width)
    push(y * width + width - 1)
  }
  while (head < tail) {
    const idx = queue[head++]!
    const x = idx % width
    if (x > 0) {
      push(idx - 1)
    }
    if (x < width - 1) {
      push(idx + 1)
    }
    if (idx >= width) {
      push(idx - width)
    }
    if (idx < subject.length - width) {
      push(idx + width)
    }
  }

  // 不可达的 0 像素按连通域分组，逐洞限量填充
  const holeLabel = new Int32Array(subject.length)
  const holeSizes = new Map<number, number[]>()
  let nextId = 0
  for (let start = 0; start < subject.length; start++) {
    if (subject[start] !== 0 || reachable[start] !== 0 || holeLabel[start] !== 0) {
      continue
    }
    nextId += 1
    head = 0
    tail = 0
    queue[tail++] = start
    holeLabel[start] = nextId
    const members: number[] = []
    while (head < tail) {
      const idx = queue[head++]!
      members.push(idx)
      const x = idx % width
      const y = Math.floor(idx / width)
      const neighbors = [
        x > 0 ? idx - 1 : -1,
        x < width - 1 ? idx + 1 : -1,
        y > 0 ? idx - width : -1,
        y < height - 1 ? idx + width : -1
      ]
      for (const next of neighbors) {
        if (next >= 0 && subject[next] === 0 && reachable[next] === 0 && holeLabel[next] === 0) {
          holeLabel[next] = nextId
          queue[tail++] = next
        }
      }
    }
    holeSizes.set(nextId, members)
  }
  for (const members of holeSizes.values()) {
    if (members.length > maxHole) {
      continue
    }
    for (const idx of members) {
      subject[idx] = 1
    }
  }
}

export function buildSubjectMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  region: Uint8Array,
  options: SubjectMaskOptions = {}
): SubjectMaskResult {
  const total = width * height
  const ring = Math.max(1, Math.min(16, options.ring ?? 4))
  const clusters = Math.max(1, Math.min(8, options.clusters ?? 6))
  const bias = Math.max(0.1, options.bias ?? 1.1)
  const snap = Math.max(0, Math.min(32, options.snap ?? 10))
  const minComponentRatio = Math.max(0, Math.min(1, options.minComponentRatio ?? 0.02))

  // 边界收缩：圈选多出的方角/富余边收贴到主体真实轮廓，背景样本环紧贴主体。
  // 圈选铺满整个工作区时没有内外之分，跳过吸附（交给 backgroundSamples=0 提示）。
  let regionPixels = 0
  for (let i = 0; i < total; i++) {
    if (region[i] === 1) {
      regionPixels += 1
    }
  }
  const snapped =
    snap > 0 && regionPixels < total * 0.95
      ? snapToEdges(region, data, width, height, snap)
      : region
  if (!snapped.some(v => v === 1)) {
    // 收缩后区域空了（图太平滑或圈太小），退回原始圈选
    snapped.set(region)
  }
  // 排除圈里的像素强制当背景（不进模型、不分主体）
  const exclude = options.exclude
  if (exclude && exclude.length === total) {
    for (let i = 0; i < total; i++) {
      if (exclude[i] === 1) {
        snapped[i] = 0
      }
    }
  }

  const regionDilated = dilate(snapped, width, ring)
  const bgSampleMask = new Uint8Array(total)
  let bgSampleCount = 0
  for (let i = 0; i < total; i++) {
    if (regionDilated[i] === 1 && snapped[i] === 0) {
      bgSampleMask[i] = 1
      bgSampleCount += 1
    }
  }
  // 圈选太贴边时，用整张图区域外像素兜底
  if (bgSampleCount < Math.max(32, Math.floor(total * 0.01))) {
    for (let i = 0; i < total; i++) {
      bgSampleMask[i] = snapped[i] === 1 ? 0 : 1
    }
  }

  const bgSamples = collectColors(data, bgSampleMask)
  const bgMeans = clusterColors(bgSamples, clusters)

  // 背景「正常波动」上限：背景样本到最近背景类中心的中位数距离 ×2，下限 16。
  // 旧实现用 p95×2：环里混进主体边缘或多彩背景时 p95 被拉爆，容差过大 →
  // 几乎所有像素都被当背景（绿整片）。中位数对混入的异常样本不敏感。
  let bgTolerance = 16
  if (bgMeans.length > 0) {
    const distances = bgSamples.map(color => nearestDistance(color, bgMeans)).sort((a, b) => a - b)
    const p50 = distances[Math.floor(distances.length * 0.5)] ?? 0
    bgTolerance = Math.max(16, p50 * 2)
  }

  // 前景模型只用「明显不像背景」的圈内像素，避免把圈内留出的背景边也算进主体。
  // 兜底：圈得太贴、全都不像背景时取离背景最远的一小撮，防止前景模型为空。
  let fgSamples: Color[] = []
  const circled = collectColors(data, snapped)
  for (const color of circled) {
    if (bgMeans.length === 0 || nearestDistance(color, bgMeans) > bgTolerance) {
      fgSamples.push(color)
    }
  }
  if (fgSamples.length < 16 && circled.length > 0) {
    const scored = circled.map(color => ({ color, dist: nearestDistance(color, bgMeans) }))
    scored.sort((a, b) => b.dist - a.dist)
    fgSamples = scored.slice(0, Math.max(1, Math.floor(scored.length * 0.1))).map(s => s.color)
  }
  const fgMeans = clusterColors(fgSamples, clusters)

  // 圈内像素先过背景容差门（不像背景），再和前景模型比最近中心，bias>1 倾向保留主体
  const subject = new Uint8Array(total)
  for (let idx = 0; idx < total; idx++) {
    if (snapped[idx] === 0) {
      continue
    }
    const offset = idx * 4
    const color: Color = [data[offset]!, data[offset + 1]!, data[offset + 2]!]
    const fgDist = fgMeans.length > 0 ? nearestDistance(color, fgMeans) : Infinity
    const bgDist = bgMeans.length > 0 ? nearestDistance(color, bgMeans) : Infinity
    if (bgMeans.length === 0) {
      // 圈选覆盖整图、没有背景样本时无法区分，先全部当主体，交给 UI 提示
      subject[idx] = 1
    } else {
      subject[idx] =
        bgDist > bgTolerance && (fgMeans.length === 0 || fgDist * bias <= bgDist) ? 1 : 0
    }
  }

  removeSmallComponents(subject, width, height, minComponentRatio)
  fillHoles(subject, width, height)

  let subjectPixels = 0
  const mask = new Uint8Array(total)
  for (let i = 0; i < total; i++) {
    if (subject[i] === 1) {
      subjectPixels += 1
    } else {
      mask[i] = 1
    }
  }

  return {
    mask,
    width,
    height,
    subjectPixels,
    backgroundPixels: total - subjectPixels,
    backgroundSamples: bgSamples.length,
    bgTolerance,
    foregroundSamples: fgSamples.length
  }
}
