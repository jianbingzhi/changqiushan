-- GoTrue 自托管引导(D3) — 在已存在的 changqiushan 库中为 GoTrue 准备角色/schema/扩展。
-- postgres 容器已带数据卷,initdb 钩子不会再跑,故本脚本由 db:auth:bootstrap 手动 psql 执行(幂等)。
-- 以超级用户 changqiushan 身份运行。

-- 1) GoTrue 连库角色(独占 auth schema)
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin LOGIN PASSWORD 'auth_dev_pwd' CREATEROLE NOINHERIT;
  END IF;
END $$;

-- 2) Supabase 约定的无登录角色(部分 GoTrue 迁移会 GRANT 到这些角色,缺则迁移失败)
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN NOINHERIT; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN NOINHERIT; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS; END IF;
END $$;
GRANT anon, authenticated, service_role TO supabase_auth_admin;

-- search_path 钉到 auth:否则 GoTrue 迁移会试图在 public 建 schema_migrations 而无权(PG15+)
ALTER ROLE supabase_auth_admin SET search_path TO auth;

-- Supabase 的 RLS 迁移 GRANT SELECT ... TO postgres,本库超级用户是 changqiushan,需补建 postgres 角色
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'postgres') THEN CREATE ROLE postgres NOLOGIN NOINHERIT; END IF;
END $$;
GRANT postgres TO supabase_auth_admin;

-- 3) auth schema(归 GoTrue 所有)+ 扩展
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 4) 应用角色(changqiushan,public schema)读 auth.users 的权限 —— 供阶段 0/1 建只读视图。
--    dev 下 changqiushan 是超级用户本可直读;显式授权是为对齐生产最小权限。
GRANT USAGE ON SCHEMA auth TO changqiushan;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth
  GRANT SELECT ON TABLES TO changqiushan;
