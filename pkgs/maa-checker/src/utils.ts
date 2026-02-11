import { Console } from 'node:console'
import * as zlib from 'node:zlib'

export function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  if (buffer.byteOffset === 0 && buffer.byteLength === buffer.buffer.byteLength) {
    return buffer.buffer as ArrayBuffer
  } else {
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer
  }
}

const emptyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=',
  'base64'
)
const image = toArrayBuffer(emptyPng)

export async function makeFakeController() {
  const ctrl = new maa.CustomController({
    connect() {
      return true
    },
    request_uuid() {
      return '0'
    },
    screencap() {
      return image
    }
  })
  await ctrl.post_connection().wait()
  return ctrl
}

export function gzCompress(data: string) {
  const buf = Buffer.from(data)
  const compressed = zlib.gzipSync(buf)
  return compressed.toString('base64')
}

export function gzDecompress(data: string): string {
  return zlib.gunzipSync(Buffer.from(data, 'base64')).toString()
}

export const console2 = new Console(process.stderr)
