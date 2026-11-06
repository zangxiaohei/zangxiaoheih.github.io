-- ============================================================================
-- 在线看板 · 谁在使用（在 Supabase「SQL 编辑器」里整块执行一次）
--
-- 作用：记下每台设备最后一次露面（页面、设备、IP、屏幕、时区），
--       后台 admin-app/who.html 就能看到「现在谁在看网站 / 谁在用后台」。
-- 说明：访客只能调函数上报自己，读不到任何人的记录；
--       只有登录后拿到 admin 身份的账号才能 select。
-- ============================================================================

begin;

create table if not exists public.site_presence (
  id        text primary key,                 -- 浏览器/设备标识（访客用 zt_vk，后台用 zt_dev）
  kind      text not null default 'visitor',  -- visitor 访客 / admin 管理员
  name      text,                             -- 后台账号邮箱（访客为空）
  page      text,                             -- 当前页面路径
  ref       text,                             -- 来源域名
  ua        text,
  device    text,                             -- 解析后的「iPhone · 中天App · Chrome」
  ip        text,
  screen    text,
  tz        text,
  lang      text,
  hits      integer not null default 1,       -- 上报次数，约等于停留时长
  first_at  timestamptz not null default now(),
  last_at   timestamptz not null default now()
);

create index if not exists idx_presence_last on public.site_presence (last_at desc);

alter table public.site_presence enable row level security;

-- 只给登录后的管理员读；匿名一律读不到
drop policy if exists p_presence_read on public.site_presence;
create policy p_presence_read on public.site_presence
  for select to authenticated using (true);

-- 管理员可以在看板上清掉过期记录
drop policy if exists p_presence_del on public.site_presence;
create policy p_presence_del on public.site_presence
  for delete to authenticated using (true);

-- 上报：匿名可调用，但只能写自己那一行
drop function if exists public.zt_presence_ping(text, text, text, text, text, text, text, text, text);

create function public.zt_presence_ping(
  p_id     text,
  p_kind   text default 'visitor',
  p_name   text default null,
  p_page   text default null,
  p_ref    text default null,
  p_ua     text default null,
  p_screen text default null,
  p_tz     text default null,
  p_lang   text default null
) returns boolean
language plpgsql security definer set search_path = public
as $fn$
declare
  v_hdr text;
  v_ip  text;
  v_ua  text;
  v_dev text;
begin
  if p_id is null or length(trim(p_id)) = 0 then
    return false;
  end if;

  v_ua := left(coalesce(p_ua, ''), 300);

  -- 真实 IP：Supabase 网关把客户端地址放在 x-forwarded-for 里
  begin
    v_hdr := nullif(current_setting('request.headers', true), '');
    if v_hdr is not null then
      v_ip := nullif(trim(split_part(coalesce((v_hdr::json) ->> 'x-forwarded-for', ''), ',', 1)), '');
    end if;
  exception when others then
    v_ip := null;
  end;
  v_ip := left(coalesce(v_ip, 'unknown'), 60);

  v_dev :=
    case
      when v_ua ~* 'iphone'            then 'iPhone'
      when v_ua ~* 'ipad'              then 'iPad'
      when v_ua ~* 'android'           then '安卓'
      when v_ua ~* 'windows'           then 'Windows'
      when v_ua ~* 'mac os|macintosh'  then 'Mac'
      when v_ua ~* 'linux'             then 'Linux'
      else '未知设备'
    end
    || case
         when v_ua ~* 'zhongtianadmin' then ' · 中天App'
         else ''
       end
    || case
         when v_ua ~* 'micromessenger' then ' · 微信'
         when v_ua ~* 'edg/'           then ' · Edge'
         when v_ua ~* 'firefox'        then ' · Firefox'
         when v_ua ~* 'crios|chrome'   then ' · Chrome'
         when v_ua ~* 'safari'         then ' · Safari'
         else ''
       end;

  insert into public.site_presence
    (id, kind, name, page, ref, ua, device, ip, screen, tz, lang, hits, first_at, last_at)
  values
    (left(trim(p_id), 64),
     case when p_kind = 'admin' then 'admin' else 'visitor' end,
     left(nullif(trim(coalesce(p_name, '')), ''), 80),
     left(coalesce(p_page, ''), 120),
     left(coalesce(p_ref, ''), 120),
     v_ua, v_dev, v_ip,
     left(coalesce(p_screen, ''), 20),
     left(coalesce(p_tz, ''), 40),
     left(coalesce(p_lang, ''), 20),
     1, now(), now())
  on conflict (id) do update set
    kind     = excluded.kind,
    name     = coalesce(excluded.name, public.site_presence.name),
    page     = excluded.page,
    ref      = excluded.ref,
    ua       = excluded.ua,
    device   = excluded.device,
    ip       = excluded.ip,
    screen   = excluded.screen,
    tz       = excluded.tz,
    lang     = excluded.lang,
    hits     = public.site_presence.hits + 1,
    -- 停了 30 分钟以上再回来，算新的一次到访，否则「停留时长」会越滚越大
    first_at = case
                 when public.site_presence.last_at < now() - interval '30 minutes' then now()
                 else public.site_presence.first_at
               end,
    last_at  = now();

  -- 顺手清理：1% 的概率清一次 30 天前的记录，不用额外定时任务
  if random() < 0.01 then
    delete from public.site_presence where last_at < now() - interval '30 days';
  end if;

  return true;
end;
$fn$;

revoke all on function public.zt_presence_ping(text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.zt_presence_ping(text, text, text, text, text, text, text, text, text) to anon, authenticated;

commit;
