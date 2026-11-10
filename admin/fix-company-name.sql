-- ============================================================================
-- 公司名称去掉"深圳市"（中文 + 英文）
--   中文：深圳市中天技术服务有限公司 → 中天技术服务有限公司
--   英文：Shenzhen Zenithe Technical Service Co., Ltd. → Zenithe Technical Service Co., Ltd.
--
-- 为什么要跑这个：
--   前台内容优先读 Supabase 的 site_content 表（key='site'），数据库里的旧值会
--   覆盖 site.js / site.en.js 里的新值。只要后台「网站内容」保存过一次，就必须跑一次
--   这个补丁，否则页面仍然显示「深圳市中天技术服务有限公司」。
--
-- 只改 company.name / company.nameEn / company.copyright 三个字段，
-- 其它内容一个字节都不碰。在 Supabase → SQL Editor 里整段粘贴运行即可，可重复运行（幂等）。
-- ============================================================================

-- 1) 公司中文名：去掉"深圳市"
UPDATE public.site_content
SET data = jsonb_set(data, '{company,name}',
                     to_jsonb(replace(data->'company'->>'name', '深圳市', ''))),
    updated_at = now()
WHERE key = 'site'
  AND coalesce(data->'company'->>'name', '') LIKE '%深圳市%';

-- 2) 公司英文名：统一写成 Zenithe Technical Service Co., Ltd.
--    （原来是 "Shenzhen zenithe Technical Service Co.,Ltd"，大小写和逗号都不规范）
UPDATE public.site_content
SET data = jsonb_set(data, '{company,nameEn}',
                     to_jsonb('Zenithe Technical Service Co., Ltd.'::text)),
    updated_at = now()
WHERE key = 'site'
  AND data->'company' ? 'nameEn'
  AND (data->'company'->>'nameEn' LIKE '%Shenzhen%'
       OR data->'company'->>'nameEn' LIKE '%深圳市%'
       OR data->'company'->>'nameEn' LIKE '%zenithe%');

-- 3) 页脚版权：中英文都清掉"深圳市 / Shenzhen"
UPDATE public.site_content
SET data = jsonb_set(data, '{company,copyright}',
                     to_jsonb(replace(replace(data->'company'->>'copyright',
                                              '深圳市', ''), 'Shenzhen ', ''))),
    updated_at = now()
WHERE key = 'site'
  AND (coalesce(data->'company'->>'copyright', '') LIKE '%深圳市%'
       OR coalesce(data->'company'->>'copyright', '') LIKE '%Shenzhen%');

-- 4) 核对结果（name = 中天技术服务有限公司；nameEn 不含 Shenzhen；copyright 干净）
SELECT key,
       data->'company'->>'name'      AS company_name,
       data->'company'->>'nameEn'    AS company_name_en,
       data->'company'->>'copyright' AS copyright
FROM public.site_content
WHERE key = 'site';
