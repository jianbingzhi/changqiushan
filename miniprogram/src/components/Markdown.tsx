import { View, Text } from '@tarojs/components'
import './Markdown.scss'

// 轻量 Markdown 渲染(小程序无 DOM,逐行解析):标题 / 粗体 / 有序无序列表 / 代码块 / 行内代码
// 仅覆盖 AI 回答常见语法,不追求完整 CommonMark;流式累加时每帧重渲安全(纯函数)

interface Seg {
  text: string
  bold?: boolean
  code?: boolean
}

// 行内解析:**粗体** 与 `行内代码`
function parseInline(line: string): Seg[] {
  const segs: Seg[] = []
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) segs.push({ text: line.slice(last, m.index) })
    if (m[2] != null) segs.push({ text: m[2], bold: true })
    else if (m[3] != null) segs.push({ text: m[3], code: true })
    last = m.index + m[0].length
  }
  if (last < line.length) segs.push({ text: line.slice(last) })
  return segs.length ? segs : [{ text: line }]
}

function Inline({ line }: { line: string }) {
  return (
    <Text>
      {parseInline(line).map((s, i) => (
        <Text key={i} className={s.bold ? 'md-bold' : s.code ? 'md-code-inline' : ''}>
          {s.text}
        </Text>
      ))}
    </Text>
  )
}

export default function Markdown({ content }: { content: string }) {
  const lines = content.split('\n')
  const blocks: JSX.Element[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    // 代码块 ```
    if (line.trim().startsWith('```')) {
      const code: string[] = []
      i += 1
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i])
        i += 1
      }
      i += 1 // 跳过结束 ```
      blocks.push(
        <View key={key++} className='md-codeblock'>
          <Text className='md-codeblock__text'>{code.join('\n')}</Text>
        </View>,
      )
      continue
    }

    // 标题 #/##/###
    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    if (h) {
      blocks.push(
        <View key={key++} className={`md-h md-h${h[1].length}`}>
          <Inline line={h[2]} />
        </View>,
      )
      i += 1
      continue
    }

    // 列表(连续行)
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items: { ordered: boolean; marker: string; text: string }[] = []
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        const om = /^\s*(\d+)\.\s+(.*)$/.exec(lines[i])
        if (om) items.push({ ordered: true, marker: `${om[1]}.`, text: om[2] })
        else {
          const um = /^\s*[-*]\s+(.*)$/.exec(lines[i])
          items.push({ ordered: false, marker: '·', text: um ? um[1] : lines[i] })
        }
        i += 1
      }
      blocks.push(
        <View key={key++} className='md-list'>
          {items.map((it, k) => (
            <View key={k} className='md-li'>
              <Text className='md-li__marker'>{it.marker}</Text>
              <View className='md-li__body'>
                <Inline line={it.text} />
              </View>
            </View>
          ))}
        </View>,
      )
      continue
    }

    // 空行
    if (line.trim() === '') {
      i += 1
      continue
    }

    // 普通段落
    blocks.push(
      <View key={key++} className='md-p'>
        <Inline line={line} />
      </View>,
    )
    i += 1
  }

  return <View className='md'>{blocks}</View>
}
