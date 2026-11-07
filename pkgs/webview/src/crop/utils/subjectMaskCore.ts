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
  /** 每侧颜色聚类数（默认 4） */
  clusters?: number
  /** 主体判定偏置，>1 更倾向保留主体（默认 1.1） */
  bias?: number
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

/** 填充主体内部的洞（被主体包围的背景像素视为主体，例如手柄上的彩色按钮） */
function fillHoles(subject: Uint8Array, width: number, height: number) {
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
  for (let idx = 0; idx < subject.length; idx++) {
    if (subject[idx] === 0 && reachable[idx] === 0) {
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
  const clusters = Math.max(1, Math.min(8, options.clusters ?? 4))
  const bias = options.bias ?? 1.1
  const minComponentRatio = Math.max(0, Math.min(1, options.minComponentRatio ?? 0.02))

  const regionDilated = dilate(region, width, ring)
  const bgSampleMask = new Uint8Array(total)
  let bgSampleCount = 0
  for (let i = 0; i < total; i++) {
    if (regionDilated[i] === 1 && region[i] === 0) {
      bgSampleMask[i] = 1
      bgSampleCount += 1
    }
  }
  // 圈选太贴边时，用整张图区域外像素兜底
  if (bgSampleCount < Math.max(32, Math.floor(total * 0.01))) {
    for (let i = 0; i < total; i++) {
      bgSampleMask[i] = region[i] === 1 ? 0 : 1
    }
  }

  const bgSamples = collectColors(data, bgSampleMask)
  const bgMeans = clusterColors(bgSamples, clusters)

  // 背景模型的「正常波动」上限：用背景样本到最近背景类中心的 95 分位再放宽 2 倍
  let bgTolerance = 0
  if (bgMeans.length > 0) {
    const distances = bgSamples.map(color => nearestDistance(color, bgMeans)).sort((a, b) => a - b)
    const p95 = distances[Math.min(distances.length - 1, Math.floor(distances.length * 0.95))] ?? 0
    bgTolerance = Math.max(30, p95 * 2)
  }

  // 前景模型只用「明显不像背景」的圈内像素，避免把圈内留出的背景边也算进主体
  const fgSamples: Color[] = []
  for (const color of collectColors(data, region)) {
    if (bgMeans.length === 0 || nearestDistance(color, bgMeans) > bgTolerance) {
      fgSamples.push(color)
    }
  }
  const fgMeans = clusterColors(fgSamples, clusters)

  const subject = new Uint8Array(total)
  for (let idx = 0; idx < total; idx++) {
    if (region[idx] === 0) {
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
    backgroundSamples: bgSamples.length
  }
}
