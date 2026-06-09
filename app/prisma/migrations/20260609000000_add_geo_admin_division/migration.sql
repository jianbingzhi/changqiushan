-- B33 来源行政区划码表(GB/T 2260)。身份证前 6 位=区县、前 4 位=市、前 2 位=省。
-- 静态参考数据 → 放迁移(migrate deploy 在所有环境含生产执行),不放 seed.ts(后者仅造演示预约、不上生产)。
-- code 按自然长度存(省2/市4/区县6),level 区分粒度,parent_code 上溯。

DO $$ BEGIN
  CREATE TYPE "GeoLevel" AS ENUM ('PROVINCE', 'CITY', 'DISTRICT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "geo_admin_division" (
  "code"        VARCHAR(6)     NOT NULL,
  "name"        VARCHAR(40)    NOT NULL,
  "level"       "GeoLevel"     NOT NULL,
  "parent_code" VARCHAR(6),
  "created_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT "geo_admin_division_pkey" PRIMARY KEY ("code")
);

CREATE INDEX IF NOT EXISTS "geo_admin_division_level_idx" ON "geo_admin_division"("level");
CREATE INDEX IF NOT EXISTS "geo_admin_division_parent_code_idx" ON "geo_admin_division"("parent_code");

-- 省级(34 个省/自治区/直辖市/特别行政区),全量覆盖 → 省级 choropleth 无遗漏
INSERT INTO "geo_admin_division" ("code","name","level","parent_code") VALUES
  ('11','北京市','PROVINCE',NULL),
  ('12','天津市','PROVINCE',NULL),
  ('13','河北省','PROVINCE',NULL),
  ('14','山西省','PROVINCE',NULL),
  ('15','内蒙古自治区','PROVINCE',NULL),
  ('21','辽宁省','PROVINCE',NULL),
  ('22','吉林省','PROVINCE',NULL),
  ('23','黑龙江省','PROVINCE',NULL),
  ('31','上海市','PROVINCE',NULL),
  ('32','江苏省','PROVINCE',NULL),
  ('33','浙江省','PROVINCE',NULL),
  ('34','安徽省','PROVINCE',NULL),
  ('35','福建省','PROVINCE',NULL),
  ('36','江西省','PROVINCE',NULL),
  ('37','山东省','PROVINCE',NULL),
  ('41','河南省','PROVINCE',NULL),
  ('42','湖北省','PROVINCE',NULL),
  ('43','湖南省','PROVINCE',NULL),
  ('44','广东省','PROVINCE',NULL),
  ('45','广西壮族自治区','PROVINCE',NULL),
  ('46','海南省','PROVINCE',NULL),
  ('50','重庆市','PROVINCE',NULL),
  ('51','四川省','PROVINCE',NULL),
  ('52','贵州省','PROVINCE',NULL),
  ('53','云南省','PROVINCE',NULL),
  ('54','西藏自治区','PROVINCE',NULL),
  ('61','陕西省','PROVINCE',NULL),
  ('62','甘肃省','PROVINCE',NULL),
  ('63','青海省','PROVINCE',NULL),
  ('64','宁夏回族自治区','PROVINCE',NULL),
  ('65','新疆维吾尔自治区','PROVINCE',NULL),
  ('71','台湾省','PROVINCE',NULL),
  ('81','香港特别行政区','PROVINCE',NULL),
  ('82','澳门特别行政区','PROVINCE',NULL)
ON CONFLICT ("code") DO NOTHING;

-- 市级(覆盖演示数据所在省 + 直辖市;其余省份的市待后续补全,未命中回退「未知」)
INSERT INTO "geo_admin_division" ("code","name","level","parent_code") VALUES
  ('1101','市辖区','CITY','11'),
  ('3101','市辖区','CITY','31'),
  ('3301','杭州市','CITY','33'),
  ('4403','深圳市','CITY','44'),
  ('5001','市辖区','CITY','50'),
  ('5101','成都市','CITY','51')
ON CONFLICT ("code") DO NOTHING;

-- 区县级(覆盖演示数据 + 各市主城区;未命中回退「未知」)
INSERT INTO "geo_admin_division" ("code","name","level","parent_code") VALUES
  -- 北京市辖区
  ('110101','东城区','DISTRICT','1101'),
  ('110102','西城区','DISTRICT','1101'),
  ('110105','朝阳区','DISTRICT','1101'),
  ('110106','丰台区','DISTRICT','1101'),
  ('110108','海淀区','DISTRICT','1101'),
  -- 上海市辖区
  ('310101','黄浦区','DISTRICT','3101'),
  ('310104','徐汇区','DISTRICT','3101'),
  ('310105','长宁区','DISTRICT','3101'),
  ('310106','静安区','DISTRICT','3101'),
  ('310107','普陀区','DISTRICT','3101'),
  ('310109','虹口区','DISTRICT','3101'),
  ('310110','杨浦区','DISTRICT','3101'),
  ('310115','浦东新区','DISTRICT','3101'),
  -- 杭州市
  ('330102','上城区','DISTRICT','3301'),
  ('330105','拱墅区','DISTRICT','3301'),
  ('330106','西湖区','DISTRICT','3301'),
  ('330108','滨江区','DISTRICT','3301'),
  ('330109','萧山区','DISTRICT','3301'),
  ('330110','余杭区','DISTRICT','3301'),
  -- 深圳市
  ('440303','罗湖区','DISTRICT','4403'),
  ('440304','福田区','DISTRICT','4403'),
  ('440305','南山区','DISTRICT','4403'),
  ('440306','宝安区','DISTRICT','4403'),
  ('440307','龙岗区','DISTRICT','4403'),
  ('440309','龙华区','DISTRICT','4403'),
  -- 重庆市辖区
  ('500103','渝中区','DISTRICT','5001'),
  ('500104','大渡口区','DISTRICT','5001'),
  ('500105','江北区','DISTRICT','5001'),
  ('500106','沙坪坝区','DISTRICT','5001'),
  ('500107','九龙坡区','DISTRICT','5001'),
  ('500108','南岸区','DISTRICT','5001'),
  -- 成都市
  ('510104','锦江区','DISTRICT','5101'),
  ('510105','青羊区','DISTRICT','5101'),
  ('510106','金牛区','DISTRICT','5101'),
  ('510107','武侯区','DISTRICT','5101'),
  ('510108','成华区','DISTRICT','5101'),
  ('510112','龙泉驿区','DISTRICT','5101'),
  ('510116','双流区','DISTRICT','5101')
ON CONFLICT ("code") DO NOTHING;
