-- ============================================================================
-- 中天官网后台 · 数据库初始化脚本（PostgreSQL）
-- 执行位置（二选一）：
--   ▶ Supabase：Navicat 连接后，打开查询窗口，整块粘贴执行
--   ▶ WorkBuddy 管理面板：应用「中天官网后台」→ 数据库管理
--
-- 使用说明：
--   ▶ Navicat / 面板支持一次执行多条：把【方式一】整块复制执行
--   ▶ 如果只能一条一条执行：按【方式二】的编号顺序，一条一条粘贴执行
--   ▶ 执行完不会有任何页面变化，只要不报错就是成功
-- ============================================================================


-- ============================================================================
-- 方式一：整块执行（面板支持多语句时用这个）
-- ============================================================================

BEGIN;

-- 表 1：站点内容（后台改的内容存这里，官网页面从这里读）
CREATE TABLE IF NOT EXISTS site_content (
  id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key        TEXT        NOT NULL UNIQUE,
  data       JSONB       NOT NULL,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.site_content TO authenticated, anon;
GRANT INSERT, UPDATE ON TABLE public.site_content TO authenticated;
DROP POLICY IF EXISTS site_content_read ON site_content;
CREATE POLICY site_content_read ON site_content
  FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS site_content_write ON site_content;
CREATE POLICY site_content_write ON site_content
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS site_content_update ON site_content;
CREATE POLICY site_content_update ON site_content
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 表 2：客户留言（访客不用登录就能提交，只有登录后才能看）
CREATE TABLE IF NOT EXISTS messages (
  id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id   TEXT        DEFAULT auth.uid(),
  name       TEXT        NOT NULL,
  phone      TEXT        NOT NULL,
  content    TEXT,
  source     TEXT        DEFAULT 'chat',
  is_read    BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON TABLE public.messages TO authenticated, anon;
GRANT SELECT, UPDATE, DELETE ON TABLE public.messages TO authenticated;
DROP POLICY IF EXISTS messages_insert_public ON messages;
CREATE POLICY messages_insert_public ON messages
  FOR INSERT TO authenticated, anon WITH CHECK (true);
DROP POLICY IF EXISTS messages_read_admin ON messages;
CREATE POLICY messages_read_admin ON messages
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS messages_update_admin ON messages;
CREATE POLICY messages_update_admin ON messages
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS messages_delete_admin ON messages;
CREATE POLICY messages_delete_admin ON messages
  FOR DELETE TO authenticated USING (true);

-- 自增序号权限
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;

COMMIT;


-- ============================================================================
-- 方式二：逐条执行（面板一次只让跑一条时，按 01~13 顺序粘贴）
-- ============================================================================

-- 01
CREATE TABLE IF NOT EXISTS site_content (
  id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key        TEXT        NOT NULL UNIQUE,
  data       JSONB       NOT NULL,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 02
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;

-- 03
GRANT SELECT ON TABLE public.site_content TO authenticated, anon;
GRANT INSERT, UPDATE ON TABLE public.site_content TO authenticated;

-- 04
CREATE POLICY site_content_read ON site_content FOR SELECT TO authenticated, anon USING (true);

-- 05
CREATE POLICY site_content_write ON site_content FOR INSERT TO authenticated WITH CHECK (true);

-- 06
CREATE POLICY site_content_update ON site_content FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 07
CREATE TABLE IF NOT EXISTS messages (
  id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id   TEXT        DEFAULT auth.uid(),
  name       TEXT        NOT NULL,
  phone      TEXT        NOT NULL,
  content    TEXT,
  source     TEXT        DEFAULT 'chat',
  is_read    BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 08
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 09
GRANT INSERT ON TABLE public.messages TO authenticated, anon;
GRANT SELECT, UPDATE, DELETE ON TABLE public.messages TO authenticated;

-- 10
CREATE POLICY messages_insert_public ON messages FOR INSERT TO authenticated, anon WITH CHECK (true);

-- 11
CREATE POLICY messages_read_admin ON messages FOR SELECT TO authenticated USING (true);

-- 12
CREATE POLICY messages_update_admin ON messages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 13
CREATE POLICY messages_delete_admin ON messages FOR DELETE TO authenticated USING (true);
