export function toPngDataUrl(buffer: Uint8Array | ArrayBuffer) {
  if (buffer instanceof ArrayBuffer) {
    return 'data:image/png;base64,' + Buffer.from(buffer).toString('base64')
  } else {
    return 'data:image/png;base64,' + Buffer.from(buffer).toString('base64')
  }
}

export function fromPngDataUrl(url: string) {
  const buf = Buffer.from(url.replace('data:image/png;base64,', ''), 'base64')
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}
