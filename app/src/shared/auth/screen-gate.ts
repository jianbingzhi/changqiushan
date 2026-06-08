// 大屏软门(无登录大屏的应用层兜底)——三处复用:middleware(edge)、
// /api/screen/[metric]、/api/screen/export/[metric]。逻辑收口于此,避免漂移。
// 纯 JS,无 node:crypto,edge + node 双运行时安全。生产以 Nginx IP 白名单为主、此为辅。
export const SCREEN_TOKEN_COOKIE = "screen_token";

// 读取并规范化期望令牌:空串 / 纯空白 视为"未配置"→ 完全开放(本地/演示零摩擦)。
// 注意:有意配置的短令牌仍生效(不静默放行),避免"配了反而不设防"的更危险陷阱。
export function expectedScreenToken(): string | null {
  const raw = process.env.SCREEN_TOKEN?.trim();
  return raw ? raw : null;
}

// 常量时间比对:避免 `===` 短路带来的时序侧信道(烈度低,但令牌比对应恒定时间)。
export function screenTokenMatches(candidate: string, expected: string): boolean {
  if (candidate.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) {
    diff |= candidate.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// 端点软门:未配置 → 放行;否则 query(?k=) 或 cookie 命中即放行。
export function screenGatePassed(query: string | null, cookie: string | undefined): boolean {
  const expected = expectedScreenToken();
  if (!expected) return true;
  return (
    (query != null && screenTokenMatches(query, expected)) ||
    (cookie != null && screenTokenMatches(cookie, expected))
  );
}
