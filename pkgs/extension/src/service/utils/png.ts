export function toPngDataUrl(buffer: Uint8Array | ArrayBuffer) {
  if (buffer instanceof ArrayBuffer) {
    return 'data:image/png;base64,' + Buffer.from(buffer).toString('base64')
  } else {
    return 'data:image/png;base64,' + Buffer.from(buffer).toString('base64')
  }
}

export function fromPngDataUrl(url: string) {
  return Buffer.from(url.replace('data:image/png;base64,', ''), 'base64').buffer
}
