-- ==========================================================================
-- 后台安全加固（在 Supabase Dashboard → SQL Editor 里整段执行）
-- 目的：把「任何登录用户都能读留言/改内容」收紧为「只有管理员账号」
--
-- 原理：app_metadata 只有用 service_role 密钥（服务端）才能写入，
--       用户自己注册时无法伪造，因此比邮箱白名单、前端隐藏 URL 都可靠。
--
-- 执行前必须做两件事：
--   1) Dashboard → Authentication → Providers → Email：关闭 "Enable sign up"
--      （否则陌生人仍可注册，虽然进来也读不到数据，但会白白产生账号）
--   2) 给管理员账号打上 role 标记，见文件末尾第 4 步
-- ==========================================================================

-- ---------- 1. 判断函数：当前请求是不是管理员 ----------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- ---------- 2. messages：匿名只能写，读写改删只有管理员 ----------
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS messages_insert_public ON public.messages;
CREATE POLICY messages_insert_public ON public.messages
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS messages_read_admin ON public.messages;
CREATE POLICY messages_read_admin ON public.messages
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS messages_update_admin ON public.messages;
CREATE POLICY messages_update_admin ON public.messages
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS messages_delete_admin ON public.messages;
CREATE POLICY messages_delete_admin ON public.messages
  FOR DELETE TO authenticated USING (public.is_admin());

GRANT INSERT ON public.messages TO anon;
GRANT SELECT, UPDATE, DELETE ON public.messages TO authenticated;

-- ---------- 3. site_content：所有人可读，写入只有管理员 ----------
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_content_read ON public.site_content;
CREATE POLICY site_content_read ON public.site_content
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS site_content_write ON public.site_content;
CREATE POLICY site_content_write ON public.site_content
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS site_content_update ON public.site_content;
CREATE POLICY site_content_update ON public.site_content
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- 4. 在线客服两张表：同样只给管理员 ----------
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_threads_admin_read ON public.chat_threads;
CREATE POLICY chat_threads_admin_read ON public.chat_threads
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS chat_threads_admin_update ON public.chat_threads;
CREATE POLICY chat_threads_admin_update ON public.chat_threads
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS chat_messages_admin_read ON public.chat_messages;
CREATE POLICY chat_messages_admin_read ON public.chat_messages
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS chat_messages_admin_insert ON public.chat_messages;
CREATE POLICY chat_messages_admin_insert ON public.chat_messages
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS chat_messages_admin_update ON public.chat_messages;
CREATE POLICY chat_messages_admin_update ON public.chat_messages
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- 5. 给管理员账号打标记 ----------
-- 先查有哪些账号：SELECT id, email, created_at FROM auth.users ORDER BY created_at;
-- 再把下面邮箱换成你的后台登录邮箱，执行后重新登录后台才会生效
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
WHERE email = '1178602362@qq.com';   -- 已填好你的后台登录邮箱

-- ---------- 6. 限制留言长度，防止被脚本灌库 ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_len_check') THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_len_check CHECK (
        char_length(COALESCE(name, ''))    <= 60  AND
        char_length(COALESCE(phone, ''))   <= 40  AND
        char_length(COALESCE(content, '')) <= 2000
      );
  END IF;
END $$;

-- 检查结果：messages 4 条 / site_content 3 条 / chat_threads 2 条 / chat_messages 3 条
SELECT tablename, policyname, cmd, roles::text
FROM pg_policies
WHERE tablename IN ('messages', 'site_content', 'chat_threads', 'chat_messages')
ORDER BY tablename, policyname;
