export function toPngDataUrl(buffer: ArrayBuffer | Buffer) {
  if (!Buffer.isBuffer(buffer)) {
    buffer = Buffer.from(buffer)
  }
  return 'data:image/png;base64,' + buffer.toString('base64')
}

export function fromPngDataUrl(url: string) {
  return Buffer.from(url.replace('data:image/png;base64,', ''), 'base64').buffer
}
