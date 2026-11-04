-- ============================================================================
-- 允许后台管理员删除聊天会话
-- 执行位置：Supabase 网页 → SQL Editor → New query → 粘贴 → Run query
-- 只需执行一次。执行后后台会话列表的 ✕ 按钮即可删除会话。
-- ============================================================================

GRANT DELETE ON TABLE public.chat_threads TO authenticated;

DROP POLICY IF EXISTS chat_threads_admin_delete ON chat_threads;
CREATE POLICY chat_threads_admin_delete ON chat_threads
  FOR DELETE TO authenticated USING (true);
