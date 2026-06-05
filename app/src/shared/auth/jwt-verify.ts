import { jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";

// 统一的 access token 验签口径(session.ts 与 middleware.ts 共用,避免双源漂移)。
// edge 安全:仅依赖 jose(无 node/next 专属 API),可在 middleware edge 运行时使用。
//
// 验签密钥两态:
// - 自托管 GoTrue(本地 docker / 最终阿里云):HS256 共享密钥(GOTRUE_JWT_SECRET)。
// - Supabase 云:用户 token 用非对称 ES256 签发,需 JWKS 公钥验签。设 GOTRUE_JWKS_URL
//   (https://<ref>.supabase.co/auth/v1/.well-known/jwks.json)即切到 JWKS;不设则走 HS256。
// createRemoteJWKSet 内部缓存公钥,不会每次请求都拉取。
const JWT_SECRET = process.env.GOTRUE_JWT_SECRET ?? "";

const JWT_ISSUER =
  process.env.GOTRUE_JWT_ISSUER ?? process.env.GOTRUE_URL ?? "http://localhost:9999";

const JWKS = process.env.GOTRUE_JWKS_URL
  ? createRemoteJWKSet(new URL(process.env.GOTRUE_JWKS_URL))
  : null;

export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    // 分支调用以匹配 jose 的两个重载(JWKS 是 getKey 函数 / 共享密钥是 Uint8Array)
    const { payload } = JWKS
      ? await jwtVerify(token, JWKS, { issuer: JWT_ISSUER })
      : await jwtVerify(token, new TextEncoder().encode(JWT_SECRET), {
          issuer: JWT_ISSUER,
        });
    return payload;
  } catch {
    return null;
  }
}
