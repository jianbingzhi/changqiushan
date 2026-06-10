-- B26 收尾(T5):时段改「规则派生 + 首单惰性物化」后,cron 预生成的展开天数配置废弃。
-- 仅清理业务表 sys_config 自身的死配置行;严禁触碰 pgboss schema(Supabase 库无该 schema)。
DELETE FROM system_config WHERE key = 'slot.horizon_days';
