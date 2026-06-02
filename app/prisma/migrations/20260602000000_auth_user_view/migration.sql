-- public.app_user 只读视图 — 从 GoTrue 管理的 auth.users 中选取稳定列
-- 仅选可靠的稳定列(id/phone/email/timestamps),GoTrue 内部字段不暴露
-- Prisma 不管理此视图:手写 SQL 创建,migrate 不会删除 VIEW(只删 TABLE)

CREATE OR REPLACE VIEW public.app_user AS
SELECT
  id,
  phone,
  email,
  created_at,
  last_sign_in_at,
  raw_app_meta_data AS app_metadata
FROM auth.users;

-- 授权:应用角色(changqiushan)可查询此视图
GRANT SELECT ON public.app_user TO changqiushan;
