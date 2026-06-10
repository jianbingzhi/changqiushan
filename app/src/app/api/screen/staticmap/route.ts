// 大屏 poster 专题一静态地图的服务端代理(评审修订 2):
// AMAP_KEY 属 Web 服务 key,直接拼进 <img src> 会泄进无登录大屏 HTML——
// 故由本路由在服务端拼 key 转发高德静态图,浏览器只见 /api/screen/staticmap。
// 参数全部服务端钉死(中心/缩放/尺寸白名单),不透传客户端 query,防 key 被借用刷量。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AMAP_STATIC_URL = "https://restapi.amap.com/v3/staticmap";
// 长秋山景区中心(GCJ-02,蒲江长秋山脊考证点)与画幅;poster 卡片为横幅比例
const CENTER = "103.6147,30.2317";
const ZOOM = "13";
const SIZE = "1000*600";

export async function GET() {
  const key = process.env.AMAP_KEY;
  if (!key) {
    return Response.json({ error: "高德地图 Key 未配置" }, { status: 503 });
  }

  const params = new URLSearchParams({
    key,
    location: CENTER,
    zoom: ZOOM,
    size: SIZE,
    scale: "2",
  });

  try {
    // fetch 级缓存 5 分钟:大屏轮询/多屏并发不重复打高德
    const res = await fetch(`${AMAP_STATIC_URL}?${params.toString()}`, {
      next: { revalidate: 300 },
    });
    const contentType = res.headers.get("content-type") ?? "";
    // 高德出错时返回 JSON(带 infocode)而非图片,转成 502 让 <img> onerror 走占位
    if (!res.ok || !contentType.startsWith("image/")) {
      return Response.json({ error: "高德静态地图服务暂不可用" }, { status: 502 });
    }
    const buf = await res.arrayBuffer();
    return new Response(buf, {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=300",
      },
    });
  } catch {
    return Response.json({ error: "高德静态地图服务暂不可用" }, { status: 502 });
  }
}
