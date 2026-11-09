-- ============================================================
-- 修复：后台自己发出的消息，不再推送到自己微信
-- 用法：整段复制粘贴到 Supabase SQL Editor，点 Run。跑完立刻生效。
--
-- 只替换推送函数，不动 token、不重建触发器、不会重复推送。
-- 效果：
--   访客发消息          → 照常推微信
--   客服在后台回复客户  → 不再推（role = admin 直接跳过）
--   客户留言            → 照常推
-- ============================================================

create or replace function public.zt_wechat_notify() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  /* 只拦在线客服表里自己发的那一半；访客来的 msg / 留言不受影响 */
  if tg_table_name = 'chat_messages' and coalesce(to_jsonb(new)->>'role', '') = 'admin' then
    return new;
  end if;

  perform net.http_post(
    url   := 'https://www.pushplus.plus/send',
    body  := jsonb_build_object(
      'token',    (select pushplus_token from public.app_secrets where id = 1),
      'title',    case when tg_table_name = 'chat_messages' then '在线客服新消息' else '新客户留言' end,
      'content',  left(coalesce(to_jsonb(new)->>'content', '有新消息，请打开后台查看'), 200),
      'template', 'txt'
    ),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  return new;
end;
$$;

-- 自检：应该看到「已跳过自己发的消息」
select
  case
    when prosrc like '%chat_messages%' and prosrc like '%admin%' then '已跳过自己发的消息'
    else '还是旧版，请重新执行'
  end as 修复状态
from pg_proc where proname = 'zt_wechat_notify' limit 1;
