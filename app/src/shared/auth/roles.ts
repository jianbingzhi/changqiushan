// 业务角色常量 — 零依赖,供 edge middleware(路由级 RBAC)与 node guard(action 强制点)共用,
// 避免双源漂移。shared 是叶子层,不依赖任何业务/基础设施代码,故 edge 运行时可安全引入。

// 所有业务角色(已登录员工)
export const ANY_STAFF = ["SUPER_ADMIN", "ADMIN", "OPERATOR"] as const;
// 管理及以上
export const ADMIN_UP = ["SUPER_ADMIN", "ADMIN"] as const;
// 仅超级管理员
export const SUPER_ONLY = ["SUPER_ADMIN"] as const;

export type AppRole = (typeof ANY_STAFF)[number];
