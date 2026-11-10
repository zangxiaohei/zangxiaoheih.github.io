-- ============================================================================
-- 一次跑完：聊天「发图片 / 发文件」+「已读 / 未读」
--
-- 怎么用：Supabase → 左边 SQL Editor → Ctrl+A 全选删掉旧内容 →
--        把下面全部粘进去 → 点 Run。看到最后一行的三个结果都是 1 / 3 / true 就成了。
--
-- 全篇没有一个 $ 符号、没有 declare 变量，复制粘贴不会掉字符。
-- 重复执行也安全（桶会更新、策略会先删后建、函数是 replace）。
-- ============================================================================

BEGIN;

-- ============================================================
-- 第一部分：存储桶 chat-files（图片和文件放这里）
-- 聊天消息里只存一个链接，不把图片塞进数据库，聊天不会变慢。
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-files', 'chat-files', true, 10485760)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 10485760;

-- 上传：访客（没登录）和客服（登录后）都能传
DROP POLICY IF EXISTS chat_files_insert ON storage.objects;
CREATE POLICY chat_files_insert ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'chat-files');

-- 读取：公开桶
DROP POLICY IF EXISTS chat_files_read ON storage.objects;
CREATE POLICY chat_files_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'chat-files');

-- 删除：只有登录后的客服能删
DROP POLICY IF EXISTS chat_files_delete ON storage.objects;
CREATE POLICY chat_files_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chat-files');

-- ============================================================
-- 第二部分：已读状态函数 chat_read_state
-- 访客是匿名身份，读不到 chat_messages 表（被行级权限锁着），
-- 所以只开一个「只返回两个数字」的函数，碰不到别人的数据。
--   last_read = 客服读到的最大的那条访客消息 id
--   unread    = 访客还没被客服读过的条数
-- ============================================================

create or replace function public.chat_read_state(p_key uuid)
returns jsonb
language sql
security definer
set search_path = public
as '
  select jsonb_build_object(
           ''last_read'', coalesce(max(m.id) filter (where m.is_read), 0),
           ''unread'',    count(*) filter (where not m.is_read)
         )
    from chat_messages m
    join chat_threads t on t.id = m.thread_id
   where t.visitor_key = p_key
     and m.role = ''visitor''
';

grant execute on function public.chat_read_state(uuid) to anon, authenticated;

COMMIT;

-- ============================================================
-- 自检：三个数字分别是 1 / 3 / true 就说明全好了
--   桶      = 1     存储桶建好了
--   策略    = 3     三条上传/读取/删除权限
--   已读函数 = true  已读状态函数已就位
-- ============================================================
select
  (select count(*) from storage.buckets
    where id = 'chat-files')                                        as "桶",
  (select count(*) from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'chat_files_%')                           as "策略",
  (select exists (select 1 from pg_proc
    where proname = 'chat_read_state'))                             as "已读函数";
