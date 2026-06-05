import { RichText } from '@tarojs/components'
import './MpHtml.scss'

interface Props {
  html: string
}

// 富文本渲染:基于 Taro 内置 RichText(weapp <rich-text>,白名单子集),无需额外依赖
// 后续如需图片懒加载/复杂排版可换 mp-html(c-05/A9 富文本场景再评估)
export function MpHtml({ html }: Props) {
  return <RichText className='mp-html' nodes={html || ''} />
}
