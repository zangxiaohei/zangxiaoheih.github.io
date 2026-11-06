-- ============================================================
-- 后台登录监控：谁在什么时候、用什么设备、从哪个 IP 登录了后台
--
-- 效果：
--   1. 每次登录（成功或失败）都记一条：时间 / 账号 / 设备 / IP / 城市
--   2. 第一次出现的 IP、或密码错误 → 微信当场推送提醒
--   3. 老设备老 IP 的日常登录只记录、不打扰
--
-- 用法：整段复制粘贴到 Supabase SQL Editor，点 Run。
--      不要手动修改任何字符（尤其成对的单引号）。
-- 全篇没有美元符号，也没有变量声明。
-- ============================================================

create extension if not exists pg_net;

create table if not exists public.admin_login_log (
  id        bigserial primary key,
  email     text,
  ok        boolean default true,
  ip        text,
  ua        text,
  device    text,
  city      text,
  is_new    boolean default false,
  logged_at timestamptz default now()
);

create index if not exists idx_login_at on public.admin_login_log (logged_at desc);
create index if not exists idx_login_ip on public.admin_login_log (ip);

alter table public.admin_login_log enable row level security;

drop policy if exists p_login_read on public.admin_login_log;
create policy p_login_read on public.admin_login_log
  for select to authenticated using (true);


drop function if exists public.zt_log_login(text, boolean, text, text);

create function public.zt_log_login(p_email text, p_ok boolean, p_ua text, p_city text)
returns boolean
language plpgsql security definer set search_path = public
as '
begin
  insert into public.admin_login_log (email, ok, ip, ua, device, city, is_new)
  select
    left(coalesce(p_email, ''''), 120),
    coalesce(p_ok, true),
    s.ip,
    s.ua,
    s.dev,
    nullif(left(coalesce(p_city, ''''), 60), ''''),
    not exists (select 1 from public.admin_login_log a where a.ip = s.ip)
  from (
    select
      coalesce(nullif(trim(split_part(
        coalesce(nullif(current_setting(''request.headers'', true), ''''), ''{}'')::json->>''x-forwarded-for'',
        '','', 1)), ''''), ''unknown'') as ip,
      left(coalesce(p_ua, ''''), 300) as ua,
      (case
         when coalesce(p_ua, '''') ~* ''iphone|ipad|ipod'' then ''iPhone/iPad''
         when coalesce(p_ua, '''') ~* ''android'' then ''安卓''
         when coalesce(p_ua, '''') ~* ''windows'' then ''Windows''
         when coalesce(p_ua, '''') ~* ''mac os|macintosh'' then ''Mac''
         when coalesce(p_ua, '''') ~* ''linux'' then ''Linux''
         else ''未知设备''
       end) || '' · '' ||
      (case
         when coalesce(p_ua, '''') ~* ''micromessenger'' then ''微信''
         when coalesce(p_ua, '''') ~* ''zhongtianadmin'' then ''App''
         when coalesce(p_ua, '''') ~* ''edg/'' then ''Edge''
         when coalesce(p_ua, '''') ~* ''firefox'' then ''Firefox''
         when coalesce(p_ua, '''') ~* ''chrome|crios'' then ''Chrome''
         when coalesce(p_ua, '''') ~* ''safari'' then ''Safari''
         else ''浏览器''
       end) as dev
  ) s;
  return true;
exception when others then
  return false;
end;
';

grant execute on function public.zt_log_login(text, boolean, text, text) to anon, authenticated;


drop trigger if exists trg_zt_login_notify on public.admin_login_log;
drop function if exists public.zt_login_notify();

create function public.zt_login_notify() returns trigger
language plpgsql security definer set search_path = public
as '
begin
  if (new.ok = false) or (new.is_new = true) then
    perform net.http_post(
      url := ''https://www.pushplus.plus/send'',
      body := jsonb_build_object(
        ''token'',   (select pushplus_token from public.app_secrets where id = 1),
        ''title'',   case when new.ok then ''有人登录了你的后台'' else ''后台登录失败（密码错误）'' end,
        ''content'', concat(
          ''<b>'', case when new.ok then ''登录成功'' else ''登录失败'' end, ''</b><br>'',
          ''账号：'', coalesce(new.email, ''-''), ''<br>'',
          ''设备：'', coalesce(new.device, ''-''), ''<br>'',
          ''IP：'', coalesce(new.ip, ''-''), coalesce('' '' || new.city, ''''), ''<br>'',
          ''时间：'', to_char(new.logged_at at time zone ''Asia/Shanghai'', ''YYYY-MM-DD HH24:MI:SS''), ''<br>'',
          case when new.is_new then ''<br><b>这是第一次出现的 IP</b>'' else '''' end
        ),
        ''template'', ''html''
      ),
      headers := jsonb_build_object(''Content-Type'', ''application/json''),
      timeout_milliseconds := 5000
    );
  end if;
  return new;
exception when others then
  return new;
end;
';

create trigger trg_zt_login_notify
after insert on public.admin_login_log
for each row execute function public.zt_login_notify();


-- 只保留最近 180 天，避免表越滚越大
delete from public.admin_login_log where logged_at < now() - interval '180 days';


select
  (select count(*) from information_schema.tables
     where table_schema = 'public' and table_name = 'admin_login_log') as 记录表,
  (select count(*) from pg_proc where proname = 'zt_log_login')             as 上报函数,
  (select count(*) from pg_trigger where tgname = 'trg_zt_login_notify')    as 提醒触发器,
  (select case when length(coalesce(pushplus_token, '')) > 8
               then '微信已配置' else '微信未配置（只记录不推送）' end
     from public.app_secrets where id = 1)                                  as 推送通道;
