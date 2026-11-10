-- ============================================================================
-- 公司名称去掉"深圳市"：中天技术服务有限公司
--
-- 为什么要跑这个：
--   前台内容优先读 Supabase 的 site_content 表（key='site'），数据库里的旧值会
--   覆盖 site.js 里的新值。只要后台「网站内容」保存过一次，就必须跑一次这个补丁，
--   否则页面仍然显示「深圳市中天技术服务有限公司」。
--
-- 只改 company.name 和 company.copyright 两个字段，其它内容一个字节都不碰。
-- 在 Supabase → SQL Editor 里整段粘贴运行即可，可重复运行（幂等）。
-- ============================================================================

-- 1) 公司中文名
UPDATE public.site_content
SET data = jsonb_set(data, '{company,name}',
                     to_jsonb(replace(data->'company'->>'name', '深圳市', ''))),
    updated_at = now()
WHERE key = 'site'
  AND data->'company'->>'name' LIKE '%深圳市%';

-- 2) 页脚版权
UPDATE public.site_content
SET data = jsonb_set(data, '{company,copyright}',
                     to_jsonb(replace(data->'company'->>'copyright', '深圳市', ''))),
    updated_at = now()
WHERE key = 'site'
  AND coalesce(data->'company'->>'copyright', '') LIKE '%深圳市%';

-- 3) 核对结果（应看到 name = 中天技术服务有限公司，copyright 里没有"深圳市"）
SELECT key,
       data->'company'->>'name'      AS company_name,
       data->'company'->>'copyright' AS copyright
FROM public.site_content
WHERE key = 'site';
