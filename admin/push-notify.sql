-- ============================================================================
-- 桌面提醒升级：手机桌面图标红点 + Web Push 推送通知
-- 作用：
--   1. messages 表加 pushed_at 列（标记哪条留言已经推送过，避免重复推）
--   2. msg_unread_count()：给"桌面图标红点"用，只返回未读数字，不暴露留言内容
--   3. push_subscriptions 表：保存"哪台设备订阅了推送"（匿名只能写入、不能查看）
--   4. VAPID 推送密钥写入服务端私有表 app_secrets（前端永远拿不到私钥）
--   5. pg_cron 每分钟把新留言交给 Edge Function 推送到你的手机
--
-- 用法：Supabase Dashboard → SQL Editor → 全文粘贴 → Run
-- 之后还需一步：部署 Edge Function（见 admin/edge-functions/notify-push/index.ts
-- 文件开头的部署说明），拿到函数地址后回来执行文件最底部的 cron 语句。
-- ============================================================================

-- ---------- 1. 留言表加"已推送"标记 ----------
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS pushed_at timestamptz;

-- ---------- 2. 未读数函数（桌面红点用，匿名可执行，只返回数字） ----------
CREATE OR REPLACE FUNCTION public.msg_unread_count()
RETURNS int
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.messages WHERE is_read = false;
$$;
GRANT EXECUTE ON FUNCTION public.msg_unread_count() TO anon, authenticated;

-- ---------- 3. 推送订阅表 ----------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  endpoint text UNIQUE NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
-- 注意：不授予任何角色对表的直接权限，匿名只能通过下面的函数写入自己那条

CREATE OR REPLACE FUNCTION public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_ua text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.push_subscriptions (endpoint, p256dh, auth, user_agent)
  VALUES (p_endpoint, p_p256dh, p_auth, p_ua)
  ON CONFLICT (endpoint) DO UPDATE
    SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent;
$$;
GRANT EXECUTE ON FUNCTION public.push_subscribe(text, text, text, text) TO anon;

-- ---------- 4. VAPID 密钥写入 app_secrets（服务端私有，前端不可读） ----------
-- 兼容处理：app_secrets 原本由《upgrade-2026-11-05.sql》（Turnstile 防灌水脚本）创建。
-- 如果还没执行过那个脚本，这里先把它建出来，保证本脚本独立可跑；已建过则跳过。
CREATE TABLE IF NOT EXISTS public.app_secrets (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  turnstile_secret text NOT NULL DEFAULT '',
  vapid_public  text NOT NULL DEFAULT '',
  vapid_private text NOT NULL DEFAULT '',
  vapid_subject text NOT NULL DEFAULT '',
  notify_shared_secret text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;
-- 关键：不授予任何角色 SELECT —— 密钥只能被服务端函数读取，前端永远拿不到
INSERT INTO public.app_secrets (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_secrets
  ADD COLUMN IF NOT EXISTS vapid_public  text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS vapid_private text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS vapid_subject text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notify_shared_secret text NOT NULL DEFAULT '';

-- ！VAPID 密钥属于机密，故意不写在这个文件里（本仓库是公开仓库，谁都能看）。
-- 需要配置时，从本机 admin/_vapid_private.txt 取值，或在 Supabase 后台手工执行：
--   UPDATE public.app_secrets SET
--     vapid_public  = '<公钥>',
--     vapid_private = '<私钥>',
--     vapid_subject = 'mailto:你的邮箱',
--     notify_shared_secret = encode(gen_random_bytes(24), 'hex')
--   WHERE id = 1;
-- 换了密钥之后，db-config.js 里的 vapidPublicKey 必须同步换成新的公钥，否则推送签名对不上。


-- 查看本次生成的共享密钥（部署 Edge Function 后配 cron 时要用）：
-- SELECT notify_shared_secret FROM public.app_secrets;

-- ---------- 5. 定时推送（部署 Edge Function 拿到函数地址后再执行） ----------
CREATE EXTENSION IF NOT EXISTS pg_cron;
-- ★ 最后一步（把两个 <尖括号占位> 换成真实值后，去掉行首 -- 再执行一次）：
-- SELECT cron.unschedule('notify-push-every-minute');
-- SELECT cron.schedule('notify-push-every-minute', '*/1 * * * *',
--   $$SELECT net.http_post(
--       url := '<EDGE_FUNCTION_URL>',
--       headers := jsonb_build_object('Content-Type','application/json',
--                                     'x-notify-secret',(SELECT notify_shared_secret FROM public.app_secrets)),
--       body := '{}'::jsonb)$$);
