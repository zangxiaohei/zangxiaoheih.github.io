-- ============================================================
-- 新留言 → 立刻推送（秒级）
-- 用法：整段复制粘贴到 Supabase SQL Editor，点 Run。不要手动改字符。
--
-- 原理：messages 表一插入就立刻调用 notify-push 函数，
--       替代原来「每分钟问一次」。延迟从 0~60 秒降到 1 秒内。
--
-- 原有的每分钟 cron 不需要删，留着当兜底：
--   notify-push 只会推 pushed_at 为空的留言，推完就打标，不会重复推。
-- ============================================================

create extension if not exists pg_net;

drop trigger if exists trg_zt_push_msg on public.messages;
drop function if exists public.zt_push_msg();

create function public.zt_push_msg() returns trigger
language plpgsql security definer set search_path = public
as '
begin
  perform net.http_post(
    url := ''https://ndjctekubqinrlyokmzp.supabase.co/functions/v1/notify-push'',
    headers := jsonb_build_object(
      ''Content-Type'', ''application/json'',
      ''x-notify-secret'', (select notify_shared_secret from public.app_secrets where id = 1)
    ),
    body := ''{}''::jsonb,
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  return new;
end;
';

create trigger trg_zt_push_msg
after insert on public.messages
for each row execute function public.zt_push_msg();

select count(*) as 触发器已建 from pg_trigger where tgname = 'trg_zt_push_msg';
