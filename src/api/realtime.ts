// 小程序无 EventSource,实时数据走轮询(slot 5s / parking 30s);BFF 仍保留 SSE 供 B 端/大屏
export { usePolling } from '@/hooks/usePolling'
