-- ============================================================================
-- 留言写入修复脚本 · 在 Supabase「SQL Editor」整块执行一次
-- 作用：1) 重写 messages 表的行级安全策略  2) 新增安全写入函数 web_save_message
-- 执行后网站留言表单即可正常提交
-- ============================================================================

BEGIN;

-- 1) 清掉 messages 表上所有旧策略（避免新旧混杂导致拒绝写入）
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='messages'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.messages';
  END LOOP;
END $$;

-- 2) 权限：任何人可写留言；只有登录的管理员能读/改/删
REVOKE ALL ON TABLE public.messages FROM anon, authenticated;
GRANT INSERT ON TABLE public.messages TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON TABLE public.messages TO authenticated;

-- 3) 重建策略
CREATE POLICY messages_insert_public ON messages
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY messages_read_admin ON messages
  FOR SELECT TO authenticated USING (true);
CREATE POLICY messages_update_admin ON messages
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY messages_delete_admin ON messages
  FOR DELETE TO authenticated USING (true);

-- 4) 安全写入函数：访客留言走这里（即使策略有问题也能写入）
CREATE OR REPLACE FUNCTION public.web_save_message(
  p_name   text DEFAULT NULL,
  p_phone  text DEFAULT NULL,
  p_content text DEFAULT NULL,
  p_source text DEFAULT 'web'
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

  INSERT INTO messages (name, phone, content, source)
  VALUES (v_name, v_phone, nullif(v_content, ''), coalesce(p_source, 'web'))
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('ok', true, 'id', new_id);
END $$;

GRANT EXECUTE ON FUNCTION public.web_save_message(text, text, text, text) TO anon, authenticated;

COMMIT;
