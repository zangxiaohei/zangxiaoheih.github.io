-- ============================================================
-- 已读回执：访客看过客服回复后，后台能显示「已读」
-- 用法：整段复制粘贴到 Supabase SQL Editor，点 Run。跑完立刻生效。
--
-- 访客是匿名身份，没有改表权限，所以走一个 security definer 函数，
-- 只允许「把自己这条会话里客服发的消息标成已读」，碰不到别人的数据。
-- ============================================================

create or replace function public.chat_mark_read(p_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from chat_threads where visitor_key = p_key;
  if v_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_thread');
  end if;

  update chat_messages
     set is_read = true
   where thread_id = v_id
     and role = 'admin'
     and is_read = false;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.chat_mark_read(uuid) to anon, authenticated;

-- 自检：应该返回 t（函数已就位）
select exists (
  select 1 from pg_proc where proname = 'chat_mark_read'
) as 已读回执已就位;

-- 顺手把历史遗留的脏数据清一下：客服消息默认算「未读」，
-- 但不能全是未读（老数据没回执，标成已读，免得后台一片红）
update chat_messages
   set is_read = true
 where role = 'admin'
   and is_read = false
   and created_at < now() - interval '7 days';
