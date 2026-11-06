-- ============================================================
-- 中天官网：客户留言 / 在线客服消息 → 秒级推送到微信
-- 用法：整段复制粘贴到 Supabase SQL Editor，点 Run。
--      不要手动修改任何字符（尤其成对的单引号）。
-- 全篇没有美元符号，也没有变量声明。
-- ============================================================

create extension if not exists pg_net;

alter table public.app_secrets add column if not exists pushplus_token text;

update public.app_secrets set pushplus_token = 'TOKEN_PLACEHOLDER' where id = 1;

drop trigger if exists trg_zt_wechat_msg on public.messages;
drop trigger if exists trg_zt_wechat_chat on public.chat_messages;
drop function if exists public.zt_wechat_notify();

create function public.zt_wechat_notify() returns trigger
language plpgsql security definer set search_path = public
as '
begin
  perform net.http_post(
    url   := ''https://www.pushplus.plus/send'',
    body  := jsonb_build_object(
      ''token'',    (select pushplus_token from public.app_secrets where id = 1),
      ''title'',    case when tg_table_name = ''chat_messages'' then ''在线客服新消息'' else ''新客户留言'' end,
      ''content'',  left(coalesce(to_jsonb(new)->>''content'', ''有新消息，请打开后台查看''), 200),
      ''template'', ''txt''
    ),
    headers := jsonb_build_object(''Content-Type'', ''application/json''),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  return new;
end;
';

create trigger trg_zt_wechat_msg
after insert on public.messages
for each row execute function public.zt_wechat_notify();

create trigger trg_zt_wechat_chat
after insert on public.chat_messages
for each row execute function public.zt_wechat_notify();

select
  (select count(*) from pg_trigger where tgname in ('trg_zt_wechat_msg', 'trg_zt_wechat_chat')) as 触发器数量,
  (select case when length(coalesce(pushplus_token, '')) > 8 then 'token 已设置' else 'token 未设置' end
     from public.app_secrets where id = 1) as 微信通道;
