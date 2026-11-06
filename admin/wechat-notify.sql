-- ============================================================
-- 中天官网：客户留言 / 在线客服消息 → 秒级推送到微信
-- 用法：把下面 update 那行引号里的占位符换成你的 PushPlus token，然后整段执行
-- 全篇无美元符号，可重复执行
-- ============================================================

-- 清理可能的残留（重复执行也不会报错）
drop trigger if exists trg_zt_wechat_notify_msg on public.messages;
drop trigger if exists trg_zt_wechat_notify_chat on public.chat_messages;
drop trigger if exists trg_zt_wx_msg on public.messages;
drop trigger if exists trg_zt_wx_chat on public.chat_messages;
drop function if exists public.zt_wechat_notify();
drop function if exists public.zt_wx_msg();
drop function if exists public.zt_wx_chat();
drop function if exists public.zt_wx_push(text, text);
drop function if exists public.zt_wechat_status();
drop function if exists public.zt_wechat_toggle(boolean, text);
drop table if exists public.v_token;

create extension if not exists pg_net;

alter table public.app_secrets add column if not exists pushplus_token text;

-- 微信接收总开关：App 里可以随时关掉（默认开）
alter table public.app_secrets add column if not exists wechat_push_enabled boolean default true;

update public.app_secrets set pushplus_token = 'TOKEN_PLACEHOLDER' where id = 1;

-- 发送函数：从表里取 token，发 HTTP 给 PushPlus。
-- 这里刻意不用 select into / declare，避免变量被当成表名。
create or replace function public.zt_wx_push(p_title text, p_body text)
returns void
language sql
security definer
set search_path = public
as '
  select net.http_post(
    url := ''https://www.pushplus.plus/send'',
    headers := jsonb_build_object(''Content-Type'', ''application/json''),
    body := jsonb_build_object(
              ''token'', s.pushplus_token,
              ''title'', p_title,
              ''content'', p_body,
              ''template'', ''html''
            ),
    timeout_milliseconds := 5000
  )
  from public.app_secrets s
  where s.id = 1
    and coalesce(s.wechat_push_enabled, true)
    and length(coalesce(s.pushplus_token, '''')) > 8
';

-- 客户留言触发器函数
create or replace function public.zt_wx_msg()
returns trigger
language plpgsql
security definer
set search_path = public
as '
begin
  perform public.zt_wx_push(
    ''新客户留言'',
    ''<b>新客户留言</b><br/>来客：'' || coalesce(to_jsonb(new)->>''name'', ''访客'')
      || ''<br/>内容：'' || left(coalesce(to_jsonb(new)->>''content'', ''（无正文）''), 300)
  );
  return new;
end;
';

-- 在线客服触发器函数（管理员自己发的消息跳过）
create or replace function public.zt_wx_chat()
returns trigger
language plpgsql
security definer
set search_path = public
as '
begin
  if lower(coalesce(to_jsonb(new)->>''role'', '''')) in (''admin'', ''agent'', ''staff'', ''operator'') then
    return new;
  end if;
  perform public.zt_wx_push(
    ''在线客服新消息'',
    ''<b>在线客服新消息</b><br/>内容：'' || left(coalesce(to_jsonb(new)->>''content'', ''（无正文）''), 300)
  );
  return new;
end;
';

create trigger trg_zt_wx_msg
after insert on public.messages
for each row execute function public.zt_wx_msg();

create trigger trg_zt_wx_chat
after insert on public.chat_messages
for each row execute function public.zt_wx_chat();

-- ---------- 开关接口（给 App 用） ----------
-- 读状态：只返回开/关，不泄露 token
create or replace function public.zt_wechat_status()
returns boolean
language sql
security definer
set search_path = public
as '
  select coalesce((select s.wechat_push_enabled from public.app_secrets s where s.id = 1), true)
';

grant execute on function public.zt_wechat_status() to anon, authenticated;

-- 切换开关：必须带上 token 才能改，防止别人乱关你的通知
create or replace function public.zt_wechat_toggle(p_on boolean, p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as '
begin
  if p_token is null or length(btrim(p_token)) < 8 then
    return false;
  end if;
  update public.app_secrets
     set wechat_push_enabled = p_on
   where id = 1
     and pushplus_token = btrim(p_token);
  if not found then
    return false;
  end if;
  return true;
end;
';

grant execute on function public.zt_wechat_toggle(boolean, text) to anon, authenticated;

select '微信通道：' || case
         when length(coalesce(pushplus_token, '')) <= 8 then '未设置 token'
         when coalesce(wechat_push_enabled, true) then '已开启（token ' || left(pushplus_token, 6) || '****）'
         else '已暂停（App 里可随时打开）' end as 状态
from public.app_secrets
where id = 1;
