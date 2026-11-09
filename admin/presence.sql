-- ============================================================================
-- 在线看板 · 谁在使用（在 Supabase「SQL 编辑器」里整块执行一次）
--
-- 作用：记下每台设备最后一次露面（页面、设备、IP、屏幕、时区），
--       以及访客授权后拍下的一帧画面；后台 admin-app/who.html 就能看到
--       「现在谁在看网站 / 谁在用后台」，并看到对方的样子。
-- 说明：访客只能调函数上报自己，读不到任何人的记录；
--       只有登录后拿到 admin 身份的账号才能 select / update / delete。
-- 幂等：已建过表的库，再执行一次只会补字段和函数，不会丢数据。
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

-- 老库补字段（画面 / 摄像头状态 / 客服请求标记）
alter table public.site_presence add column if not exists cam      text    not null default 'none';
alter table public.site_presence add column if not exists photo    text;              -- 原图 data:image/jpeg;base64,...
alter table public.site_presence add column if not exists thumb    text;              -- 缩略图（看板列表用，别每次都拉原图）
alter table public.site_presence add column if not exists photo_at timestamptz;       -- 抓拍时间
alter table public.site_presence add column if not exists ask      boolean not null default false; -- 客服点了「请给我看画面」

create index if not exists idx_presence_last on public.site_presence (last_at desc);

alter table public.site_presence enable row level security;

-- 只给登录后的管理员读；匿名一律读不到
drop policy if exists p_presence_read on public.site_presence;
create policy p_presence_read on public.site_presence
  for select to authenticated using (true);

-- 管理员在看板上点「请给我看画面」→ 置 ask；也能清掉过期记录
drop policy if exists p_presence_upd on public.site_presence;
create policy p_presence_upd on public.site_presence
  for update to authenticated using (true) with check (true);

drop policy if exists p_presence_del on public.site_presence;
create policy p_presence_del on public.site_presence
  for delete to authenticated using (true);

-- RLS 之外还得有表级授权，否则会报 permission denied
grant select, update, delete on public.site_presence to authenticated;
revoke all on public.site_presence from anon;   -- 匿名只能走下面的函数


-- ---------------------------------------------------------------------------
-- 1) 心跳上报：匿名可调用，但只能写自己那一行
--    返回 jsonb：{ ok, ask }，ask=true 表示客服正在请求看画面
-- ---------------------------------------------------------------------------
drop function if exists public.zt_presence_ping(text, text, text, text, text, text, text, text, text);
drop function if exists public.zt_presence_ping(text, text, text, text, text, text, text, text, text, text);

create function public.zt_presence_ping(
  p_id     text,
  p_kind   text default 'visitor',
  p_name   text default null,
  p_page   text default null,
  p_ref    text default null,
  p_ua     text default null,
  p_screen text default null,
  p_tz     text default null,
  p_lang   text default null,
  p_cam    text default null            -- 可选：none / on / deny / na
) returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  v_hdr  text;
  v_ip   text;
  v_ua   text;
  v_dev  text;
  v_cam  text;
  v_ask  boolean := false;
begin
  if p_id is null or length(trim(p_id)) = 0 then
    return jsonb_build_object('ok', false, 'ask', false);
  end if;

  v_ua := left(coalesce(p_ua, ''), 300);
  v_cam := case when p_cam in ('none', 'on', 'deny', 'na') then p_cam else null end;

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
    (id, kind, name, page, ref, ua, device, ip, screen, tz, lang, cam, hits, first_at, last_at)
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
     coalesce(v_cam, 'none'),
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
    cam      = coalesce(v_cam, public.site_presence.cam),
    hits     = public.site_presence.hits + 1,
    -- 停了 30 分钟以上再回来，算新的一次到访，否则「停留时长」会越滚越大
    first_at = case
                 when public.site_presence.last_at < now() - interval '30 minutes' then now()
                 else public.site_presence.first_at
               end,
    last_at  = now()
  returning ask into v_ask;

  -- 顺手清理：1% 的概率清一次 30 天前的记录，不用额外定时任务
  if random() < 0.01 then
    delete from public.site_presence where last_at < now() - interval '30 days';
  end if;

  return jsonb_build_object('ok', true, 'ask', coalesce(v_ask, false));
end;
$fn$;

revoke all on function public.zt_presence_ping(text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.zt_presence_ping(text, text, text, text, text, text, text, text, text, text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 2) 抓拍上报：访客点了「允许」之后，把压缩好的一帧发上来
--    只能改自己那行（update，不新建），照片必须是 data:image/*，
--    并且长度设上限，防止有人拿这个接口塞大文件。
-- ---------------------------------------------------------------------------
drop function if exists public.zt_presence_photo(text, text, text);
drop function if exists public.zt_presence_photo(text, text, text, text);

create function public.zt_presence_photo(
  p_id    text,
  p_photo text,
  p_cam   text default 'on',
  p_thumb text default null
) returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  v_len integer;
begin
  if p_id is null or length(trim(p_id)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_id');
  end if;

  v_len := coalesce(length(p_photo), 0);

  -- 允许只上报状态（比如用户拒绝、设备没有摄像头），此时 photo 传空
  if v_len = 0 then
    update public.site_presence
       set cam = case when p_cam in ('none', 'on', 'deny', 'na') then p_cam else cam end,
           -- 访客明确拒绝 → 撤掉「请求」标记，别让每次开页面都再弹一次；
           -- 客服需要时可以在看板上重新点「看画面」
           ask = case when p_cam = 'deny' then false else ask end
     where id = left(trim(p_id), 64);
    return jsonb_build_object('ok', true, 'saved', false);
  end if;

  if v_len > 400000 or p_photo not like 'data:image/%' then
    return jsonb_build_object('ok', false, 'reason', 'bad_photo');
  end if;

  update public.site_presence
     set photo    = p_photo,
         thumb    = case when p_thumb like 'data:image/%' and length(p_thumb) <= 40000
                         then p_thumb else null end,
         photo_at = now(),
         cam      = 'on',
         ask      = false          -- 拍到了，把「请求」标记清掉
   where id = left(trim(p_id), 64);

  return jsonb_build_object('ok', true, 'saved', true);
end;
$fn$;

revoke all on function public.zt_presence_photo(text, text, text, text) from public;
grant execute on function public.zt_presence_photo(text, text, text, text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 3) 管理员「请给我看画面」：置 / 清 ask 标记
--    网页端也可以直接 update 表（有 p_presence_upd 策略），这个函数只是顺手。
-- ---------------------------------------------------------------------------
drop function if exists public.zt_presence_ask(text, boolean);

create function public.zt_presence_ask(p_id text, p_ask boolean default true)
returns boolean
language plpgsql security definer set search_path = public
as $fn$
begin
  -- 只授权给 authenticated，匿名调不进来
  update public.site_presence set ask = coalesce(p_ask, true) where id = left(trim(p_id), 64);
  return found;
end;
$fn$;

revoke all on function public.zt_presence_ask(text, boolean) from public;
revoke all on function public.zt_presence_ask(text, boolean) from anon;
grant execute on function public.zt_presence_ask(text, boolean) to authenticated;

commit;
