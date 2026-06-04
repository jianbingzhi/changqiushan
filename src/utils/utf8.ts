// 手写 UTF-8 解码:小程序无全局 TextDecoder;对整段累积字节解码,末尾不完整多字节自动留待下一片段
export function decodeUtf8(bytes: Uint8Array): string {
  let result = ''
  let i = 0
  const len = bytes.length
  while (i < len) {
    const b = bytes[i]
    if (b < 0x80) {
      result += String.fromCharCode(b)
      i += 1
    } else if (b >= 0xc0 && b < 0xe0) {
      if (i + 1 >= len) break
      result += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f))
      i += 2
    } else if (b >= 0xe0 && b < 0xf0) {
      if (i + 2 >= len) break
      result += String.fromCharCode(
        ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f),
      )
      i += 3
    } else {
      if (i + 3 >= len) break
      const cp =
        ((b & 0x07) << 18) |
        ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) |
        (bytes[i + 3] & 0x3f)
      const c = cp - 0x10000
      result += String.fromCharCode(0xd800 + (c >> 10), 0xdc00 + (c & 0x3ff))
      i += 4
    }
  }
  return result
}
