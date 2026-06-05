#!/usr/bin/env node
// 评审 #13:守护"双要素 schema 单一源"——端内 shared-schema/booking.ts 与后端 createBookingSchema
// 必须字段/正则/refine 文案一致(仅允许后端多出 channel 字段)。漂移则 CI 失败。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const FRONT = resolve(here, '../shared-schema/booking.ts')
const BACK = resolve(here, '../../app/src/modules/booking/domain/schema.ts')

// 提取 `字段: z....,` 规格(去空白),以及 refine 的中文 message 集合
function extract(src) {
  const fields = {}
  const fieldRe = /^\s*([a-zA-Z]+)\s*:\s*(z\.[^\n]+?),?\s*$/gm
  let m
  while ((m = fieldRe.exec(src)) !== null) {
    fields[m[1]] = m[2].replace(/\s+/g, '')
  }
  const messages = [...src.matchAll(/message:\s*"([^"]+)"/g)].map((x) => x[1]).sort()
  return { fields, messages }
}

const front = extract(readFileSync(FRONT, 'utf8'))
const back = extract(readFileSync(BACK, 'utf8'))

const errors = []

// 后端允许多出 channel;其余字段必须逐一一致
for (const [name, spec] of Object.entries(back.fields)) {
  if (name === 'channel') continue
  if (front.fields[name] == null) errors.push(`端内缺少字段 ${name}`)
  else if (front.fields[name] !== spec)
    errors.push(`字段 ${name} 不一致:\n  后端 ${spec}\n  端内 ${front.fields[name]}`)
}
for (const name of Object.keys(front.fields)) {
  if (name !== 'channel' && back.fields[name] == null) errors.push(`端内多出字段 ${name}(后端无)`)
}
if (JSON.stringify(front.messages) !== JSON.stringify(back.messages)) {
  errors.push(`refine 文案不一致:\n  后端 ${JSON.stringify(back.messages)}\n  端内 ${JSON.stringify(front.messages)}`)
}

if (errors.length) {
  console.error('✗ shared-schema 与后端 createBookingSchema 漂移(红线#2 双要素单一源):\n')
  console.error(errors.join('\n'))
  console.error('\n请同步修改两处:miniprogram/shared-schema/booking.ts 与 app/src/modules/booking/domain/schema.ts')
  process.exit(1)
}
console.log('✓ shared-schema 与后端 createBookingSchema 一致(忽略后端 channel 字段)')
