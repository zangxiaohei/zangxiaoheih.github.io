-- ============================================================================
-- 在线客服 · 会话表与接口（在 Supabase「SQL 编辑器」里整块执行一次）
-- 执行后：网站聊天框变成可连续对话，后台可查看会话并回复
-- ============================================================================

BEGIN;

-- 会话（每个访客一条，靠浏览器里随机生成的 visitor_key 识别）
CREATE TABLE IF NOT EXISTS chat_threads (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_key uuid        NOT NULL UNIQUE,
  name        text,
  phone       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_at     timestamptz NOT NULL DEFAULT now()
);

-- 聊天消息（role: visitor 访客 / admin 客服）
CREATE TABLE IF NOT EXISTS chat_messages (
  id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  thread_id  uuid        NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  role       text        NOT NULL DEFAULT 'visitor' CHECK (role IN ('visitor','admin')),
  content    text        NOT NULL,
  is_read    boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_thread_idx ON chat_messages(thread_id, id);

ALTER TABLE chat_threads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 只有登录后的管理员能直接读写这两张表
GRANT SELECT, UPDATE ON TABLE public.chat_threads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_messages TO authenticated;

DROP POLICY IF EXISTS chat_threads_admin_read ON chat_threads;
CREATE POLICY chat_threads_admin_read ON chat_threads
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS chat_threads_admin_update ON chat_threads;
CREATE POLICY chat_threads_admin_update ON chat_threads
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS chat_messages_admin_read ON chat_messages;
CREATE POLICY chat_messages_admin_read ON chat_messages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS chat_messages_admin_insert ON chat_messages;
CREATE POLICY chat_messages_admin_insert ON chat_messages
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS chat_messages_admin_update ON chat_messages;
CREATE POLICY chat_messages_admin_update ON chat_messages
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 访客发消息：只允许写自己 visitor_key 对应的会话（匿名，不给表权限，只给函数）
CREATE OR REPLACE FUNCTION public.chat_visitor_send(
  p_key uuid,
  p_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_content text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread uuid;
  v_content text;
BEGIN
  v_content := btrim(coalesce(p_content, ''));
  IF v_content = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty');
  END IF;
  v_content := left(v_content, 2000);

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

-- 访客拉取自己的会话消息
CREATE OR REPLACE FUNCTION public.chat_fetch(p_key uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread chat_threads;
  v_msgs   jsonb;
BEGIN
  SELECT * INTO v_thread FROM chat_threads WHERE visitor_key = p_key;
  IF v_thread.id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'messages', '[]'::jsonb);
  END IF;

  SELECT coalesce(
           jsonb_agg(
             jsonb_build_object(
               'id', m.id, 'role', m.role, 'content', m.content, 'created_at', m.created_at
             ) ORDER BY m.id
           ), '[]'::jsonb)
    INTO v_msgs
    FROM chat_messages m
   WHERE m.thread_id = v_thread.id;

  RETURN jsonb_build_object('ok', true, 'thread_id', v_thread.id, 'messages', v_msgs);
END $$;

GRANT EXECUTE ON FUNCTION public.chat_visitor_send(uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_fetch(uuid) TO anon, authenticated;

COMMIT;
