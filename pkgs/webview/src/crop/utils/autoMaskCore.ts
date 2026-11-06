/**
 * 自动涂绿的核心算法（纯函数，无 DOM 依赖，便于单测）。
 * 思路参考 Auto-Green-Background 的 border-grow / 背景色估计，但输入是 RGBA
 * ImageData，输出背景 mask；不依赖 OpenCV。
 */
export type AutoMaskMethod = 'border-grow' | 'threshold'

export type AutoMaskOptions = {
  method: AutoMaskMethod
  /** 每通道最大差值（Chebyshev 距离） */
  tolerance: number
  /** 背景向外膨胀的像素数 */
  expand?: number
  /** 边缘采样宽度，默认按图像短边自适应 */
  borderSample?: number
}

export type AutoMaskResult = {
  mask: Uint8Array
  width: number
  height: number
  backgroundPixels: number
}

function median(values: number[]) {
  values.sort((a, b) => a - b)
  return values[Math.floor(values.length / 2)] ?? 0
}

export function estimateBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  borderSample?: number
): [number, number, number] {
  const border = Math.max(1, Math.min(borderSample ?? 4, Math.floor(Math.min(width, height) / 4)))
  const rs: number[] = []
  const gs: number[] = []
  const bs: number[] = []
  const take = (x: number, y: number) => {
    const idx = (y * width + x) * 4
    rs.push(data[idx]!)
    gs.push(data[idx + 1]!)
    bs.push(data[idx + 2]!)
  }
  for (let y = 0; y < Math.min(border, height); y++) {
    for (let x = 0; x < width; x++) {
      take(x, y)
      take(x, height - 1 - y)
    }
  }
  for (let x = 0; x < Math.min(border, width); x++) {
    for (let y = 0; y < height; y++) {
      take(x, y)
      take(width - 1 - x, y)
    }
  }
  return [median(rs), median(gs), median(bs)]
}

function colorDistance(data: Uint8ClampedArray, idx: number, background: [number, number, number]) {
  return Math.max(
    Math.abs(data[idx]! - background[0]),
    Math.abs(data[idx + 1]! - background[1]),
    Math.abs(data[idx + 2]! - background[2])
  )
}

function dilate(mask: Uint8Array, width: number, height: number) {
  const total = width * height
  const next = mask.slice()
  for (let idx = 0; idx < total; idx++) {
    if (mask[idx] !== 1) {
      continue
    }
    const x = idx % width
    if (x > 0) next[idx - 1] = 1
    if (x < width - 1) next[idx + 1] = 1
    if (idx >= width) next[idx - width] = 1
    if (idx < total - width) next[idx + width] = 1
  }
  return next
}

export function buildBackgroundMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: AutoMaskOptions
): AutoMaskResult {
  const total = width * height
  const background = estimateBackground(data, width, height, options.borderSample)
  const tolerance = Math.max(0, options.tolerance)

  const pass = new Uint8Array(total)
  for (let i = 0; i < total; i++) {
    pass[i] = colorDistance(data, i * 4, background) <= tolerance ? 1 : 0
  }

  let mask = new Uint8Array(total)
  if (options.method === 'threshold') {
    mask.set(pass)
  } else {
    // 边缘泛洪：每个像素最多入队一次，线性时间
    const queue = new Int32Array(total)
    let head = 0
    let tail = 0
    const enqueue = (idx: number) => {
      if (pass[idx] === 1 && mask[idx] === 0) {
        mask[idx] = 1
        queue[tail++] = idx
      }
    }
    for (let x = 0; x < width; x++) {
      enqueue(x)
      enqueue((height - 1) * width + x)
    }
    for (let y = 0; y < height; y++) {
      enqueue(y * width)
      enqueue(y * width + width - 1)
    }
    while (head < tail) {
      const idx = queue[head++]!
      const x = idx % width
      if (x > 0) {
        enqueue(idx - 1)
      }
      if (x < width - 1) {
        enqueue(idx + 1)
      }
      if (idx >= width) {
        enqueue(idx - width)
      }
      if (idx < total - width) {
        enqueue(idx + width)
      }
    }
  }

  const expandBy = Math.max(0, Math.min(8, options.expand ?? 0))
  for (let round = 0; round < expandBy; round++) {
    mask = dilate(mask, width, height)
  }

  let backgroundPixels = 0
  for (let i = 0; i < total; i++) {
    if (mask[i] === 1) {
      backgroundPixels += 1
    }
  }

  return { mask, width, height, backgroundPixels }
}
