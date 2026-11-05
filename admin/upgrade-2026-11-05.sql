-- ============================================================================
-- 安全升级脚本（2026-11-05）
-- 内容：
--   1. 在线聊天每日限额：同一访客每天最多发送 100 条，超出返回 limit
--   2. 接入 Cloudflare Turnstile 人机验证：
--      - 留言表单（聊天框留言 / 联系页表单）提交必须携带有效 token
--      - 密钥保存在服务端私有表 app_secrets，前端永远拿不到
--      - 未配置密钥时自动跳过校验（所以现在执行不会影响现有功能）
--   3. 校验通过 pg_net 服务端直连 Cloudflare siteverify，无法被前端伪造
--
-- 用法：Supabase Dashboard → SQL Editor → New query → 全文粘贴 → Run
-- ============================================================================

BEGIN;

-- ---------- 1. 启用 pg_net（服务端发 HTTP 请求用，Supabase 内置） ----------
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ---------- 2. 密钥私有表（只在服务端可见，须先收回匿名权限） ----------
CREATE TABLE IF NOT EXISTS public.app_secrets (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  turnstile_secret text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;
-- 关键：任何角色（含 authenticated）都不授予 SELECT —— 密钥只能被 SECURITY DEFINER 函数读取

INSERT INTO public.app_secrets (id, turnstile_secret)
VALUES (1, '')   -- ← 拿到 Cloudflare Turnstile 的 Secret Key 后，把 '' 换成密钥再执行这一行
ON CONFLICT (id) DO NOTHING;

-- ---------- 3. Turnstile 校验函数 ----------
-- 返回 true = 通过；secret 未配置时直接放行（便于先部署后配钥）
CREATE OR REPLACE FUNCTION public.turnstile_ok(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
  v_req    bigint;
  v_ok     boolean;
  i        int;
BEGIN
  SELECT turnstile_secret INTO v_secret FROM public.app_secrets WHERE id = 1;
  IF coalesce(v_secret, '') = '' THEN
    RETURN true;   -- 未配置密钥：暂不校验
  END IF;
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN false;
  END IF;

  BEGIN
    v_req := net.http_post(
      url  := 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      body := jsonb_build_object('secret', v_secret, 'response', btrim(p_token))
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN false;  -- 网络异常：宁可拒绝也不放行
  END;

  -- pg_net 是异步的，轮询等结果（最多约 3 秒）
  FOR i IN 1..20 LOOP
    PERFORM pg_sleep(0.15);
    BEGIN
      SELECT (r.response->>'success')::boolean INTO v_ok
        FROM net._http_response r WHERE r.id = v_req;
    EXCEPTION WHEN OTHERS THEN
      v_ok := NULL;
    END;
    EXIT WHEN v_ok IS NOT NULL;
  END LOOP;

  DELETE FROM net._http_response WHERE id = v_req;   -- 清理，防表膨胀
  RETURN coalesce(v_ok, false);
END $$;

-- ---------- 4. 聊天发消息：加每日限额（100 条/人/天）+ 留言表单 Turnstile ----------
CREATE OR REPLACE FUNCTION public.chat_visitor_send(
  p_key uuid,
  p_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_content text DEFAULT NULL,
  p_need_captcha boolean DEFAULT false,
  p_token text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread uuid;
  v_content text;
  v_cnt bigint;
BEGIN
  v_content := btrim(coalesce(p_content, ''));
  IF v_content = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty');
  END IF;
  v_content := left(v_content, 2000);

  -- ★ 每日限额：同一访客（浏览器）当天最多 100 条
  SELECT count(*) INTO v_cnt
    FROM chat_messages m
    JOIN chat_threads t ON t.id = m.thread_id
   WHERE t.visitor_key = p_key
     AND m.role = 'visitor'
     AND m.created_at >= date_trunc('day', now());
  IF v_cnt >= 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'limit', 'count', v_cnt);
  END IF;

  -- ★ 留言表单需要人机验证；普通聊天消息不验证（靠限额兜底）
  IF p_need_captcha AND NOT public.turnstile_ok(p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'captcha');
  END IF;

  INSERT INTO chat_threads (visitor_key, name, phone, last_at)
  VALUES (
    p_key,
    nullif(btrim(coalesce(p_name, '')), ''),
    nullif(btrim(coalesce(p_phone, '')), ''),
    now()
  )
  ON CONFLICT (visitor_key) DO UPDATE
    SET name     = coalesce(nullif(btrim(coalesce(p_name, '')), ''), chat_threads.name),
        phone    = coalesce(nullif(btrim(coalesce(p_phone, '')), ''), chat_threads.phone),
        last_at  = now()
  RETURNING id INTO v_thread;

  INSERT INTO chat_messages (thread_id, role, content)
  VALUES (v_thread, 'visitor', v_content);

  RETURN jsonb_build_object('ok', true);
END $$;

-- ---------- 5. 留言表：提交必须通过 Turnstile ----------
CREATE OR REPLACE FUNCTION public.web_save_message(
  p_name   text DEFAULT NULL,
  p_phone  text DEFAULT NULL,
  p_content text DEFAULT NULL,
  p_source text DEFAULT 'web',
  p_token  text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_name text; v_phone text; v_content text; new_id bigint;
BEGIN
  v_name   := left(btrim(coalesce(p_name, '')), 80);
  v_phone  := left(btrim(coalesce(p_phone, '')), 40);
  v_content := left(btrim(coalesce(p_content, '')), 2000);
  IF v_name = '' OR v_phone = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', '姓名和电话必填');
  END IF;

  IF NOT public.turnstile_ok(p_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'captcha');
  END IF;

  INSERT INTO messages (name, phone, content, source)
  VALUES (v_name, v_phone, nullif(v_content, ''), coalesce(p_source, 'web'))
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('ok', true, 'id', new_id);
END $$;

-- ---------- 6. 收紧直插通道：留言必须走带验证的 web_save_message 函数 ----------
-- 删掉 messages 表所有匿名 INSERT 策略（否则灌水脚本可拿公开密钥绕过验证码直插表）
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'messages' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.messages', r.policyname);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.chat_visitor_send(uuid, text, text, text, boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_fetch(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.web_save_message(text, text, text, text, text) TO anon, authenticated;

-- ---------- 7. 自检 ----------
-- 执行完后跑这句确认：应看到 3 个函数（参数个数不同算 3 行）
-- SELECT p.proname, pg_get_function_identity_arguments(p.oid)
-- FROM pg_proc p WHERE p.proname IN ('chat_visitor_send','web_save_message','turnstile_ok');

COMMIT;

-- ============================================================================
-- 后续两步（拿到 Cloudflare 密钥后）：
-- ① Cloudflare Dashboard → Turnstile → Add site：
--    域名填 zangxiaohei.github.io，类型选 Managed，拿到 Site Key 和 Secret Key
-- ② Site Key 填进网站文件 assets/js/db-config.js 的 turnstileSiteKey
--    Secret Key 在 SQL Editor 执行：
--      UPDATE app_secrets SET turnstile_secret = '你的SecretKey', updated_at = now();
--    配好后验证自动生效（未配时全放行，配好后强制校验）
-- ============================================================================
