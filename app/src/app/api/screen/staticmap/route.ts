import type { NextRequest } from "next/server";
import { screenGatePassed } from "@/shared/auth/screen-gate";

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

// 与 /api/screen/[metric] 同口径:设软门时数据私有,防中间缓存跨用户复用
function cacheControl(): string {
  return process.env.SCREEN_TOKEN ? "private, max-age=300" : "public, max-age=300";
}

export async function GET(req: NextRequest) {
  // 软门口径与 [metric] 路由对齐(审计 P2-4):配置 SCREEN_TOKEN 时本路由同样要凭据
  if (!screenGatePassed(req.nextUrl.searchParams.get("k"), req.cookies.get("screen_token")?.value)) {
    return Response.json(
      { error: "缺少有效访问凭据" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const key = process.env.AMAP_KEY;
  if (!key) {
    return Response.json(
      { error: "高德地图 Key 未配置" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
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
    // 高德出错时返回 JSON(带 infocode)而非图片,统一 502 固定文案(不透传上游错误体)
    if (!res.ok || !contentType.startsWith("image/")) {
      return Response.json(
        { error: "高德静态地图服务暂不可用" },
        { status: 502, headers: { "cache-control": "no-store" } },
      );
    }
    const buf = await res.arrayBuffer();
    return new Response(buf, {
      headers: {
        "content-type": contentType,
        "cache-control": cacheControl(),
      },
    });
  } catch {
    return Response.json(
      { error: "高德静态地图服务暂不可用" },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
