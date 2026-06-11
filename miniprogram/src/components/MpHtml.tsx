interface Props {
  html: string
}

// 原生 mp-html 组件的 JSX 声明(@types/react 18.2.21+ / 19 均走 react JSX namespace 增强)。
// 组件本体在 subpkg-activity/components/mp-html(原生第三方组件,经 copy 进 dist,
// 由调用页 index.config.ts 的 usingComponents 注册,不走 Taro 编译)。
// ⚠️ 仅限 subpkg-activity 分包页面使用(b-103 评审 #9):其他页面 import 本组件编译不报错,
// 但 <mp-html> 未在该页 usingComponents 注册 → 微信按未知元素静默渲染,正文整块空白;
// 且微信分包隔离禁止跨包引用组件文件——要在主包/其他分包用,须把组件本体复制到目标包
// 并补 usingComponents + config copy,不是加一行配置能解决的。
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'mp-html': {
        content?: string
        'container-style'?: string
        'tag-style'?: Record<string, string>
        'lazy-load'?: boolean
        'show-img-menu'?: boolean
      }
    }
  }
}

// 对齐原 rich-text 视觉:正文行高/字号经 container-style,图片圆角与链接主色经 tag-style。
// mp-html 支持 video/a 可点/图片预览,解掉 <rich-text> 不支持 video 与 a 链接不可点的旧债(T2a)。
// CSS 变量可继承穿透组件样式隔离,带回退值保证浅/深主题与异常场景均可读
const CONTAINER_STYLE = 'font-size: 15px; line-height: 1.7; color: var(--text-primary, #1F2937); word-break: break-word;'
const TAG_STYLE = {
  img: 'max-width: 100%; border-radius: 12rpx; margin: 8rpx 0;',
  a: 'color: var(--brand, #2D5A27); text-decoration: none;',
  p: 'margin: 8rpx 0;',
  video: 'width: 100%; border-radius: 12rpx; margin: 8rpx 0;'
}

export function MpHtml({ html }: Props) {
  return (
    <mp-html
      content={html || ''}
      container-style={CONTAINER_STYLE}
      tag-style={TAG_STYLE}
      lazy-load
    />
  )
}
