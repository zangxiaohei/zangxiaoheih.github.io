-- ============================================================
-- 已读状态查询：访客端显示「已送达 / 已读」
-- 用法：整段复制粘贴到 Supabase SQL Editor，点 Run。跑完立刻生效。
--
-- 说明：访客是匿名身份，读不到 chat_messages 表（行级权限锁着），
-- 所以这里开一个只返回两个数字的函数，碰不到别人数据。
-- 全篇没有 $ 符号、没有变量声明，复制粘贴不会掉字符。
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

-- 自检：应该返回 t（函数已就位）
select exists (
  select 1 from pg_proc where proname = 'chat_read_state'
) as 已读状态函数已就位;
