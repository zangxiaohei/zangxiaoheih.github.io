-- ============================================================
-- 中天官网：客户留言 / 在线客服消息 → 秒级推送到微信
--
-- 原理：数据库一有新记录，立刻用 pg_net 发一个 HTTP 请求到 PushPlus，
--       微信「服务通知」秒级弹出来（有声音、有横幅）。
--       和 App、自启动、定时任务全部无关 —— 手机不装 App 也能收到。
--
-- 全篇不使用美元符号（$$），可以整段粘贴执行，不会被吃掉字符。
-- 执行前请把下面这行的 TOKEN 换成你的 PushPlus token。
-- ============================================================

create extension if not exists pg_net;

alter table public.app_secrets add column if not exists pushplus_token text;

update public.app_secrets set pushplus_token = 'TOKEN_PLACEHOLDER' where id = 1;

-- ---------- 触发器函数：新消息 → 微信 ----------
create or replace function public.zt_wechat_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as '
declare
  v_token text;
  v_kind  text;
  v_name  text;
  v_text  text;
  v_title text;
  v_body  text;
  j jsonb;
begin
  select pushplus_token into v_token from public.app_secrets where id = 1;
  if v_token is null or length(btrim(v_token)) < 8 then
    return new;
  end if;

  j := to_jsonb(new);

  -- 表名决定文案；chat_messages 里管理员自己发的消息不推
  if tg_table_name = ''chat_messages'' then
    if lower(coalesce(j->>''role'', '''')) in (''admin'', ''agent'', ''staff'', ''operator'') then
      return new;
    end if;
    v_kind := ''在线客服新消息'';
  else
    v_kind := ''新客户留言'';
  end if;

  v_name := coalesce(nullif(btrim(coalesce(j->>''name'', j->>''nickname'', '''')), ''''), ''访客'');
  v_text := coalesce(nullif(btrim(coalesce(j->>''content'', j->>''message'', '''')), ''''), ''（无正文）'');

  if length(v_text) > 300 then
    v_text := substring(v_text from 1 for 300) || ''...'';
  end if;

  -- 客户输入里可能有尖括号，转义一下，防止把微信消息排版搞坏
  v_text := replace(replace(replace(v_text, ''&'', ''&amp;''), ''<'', ''&lt;''), ''>'', ''&gt;'');
  v_name := replace(replace(replace(v_name, ''&'', ''&amp;''), ''<'', ''&lt;''), ''>'', ''&gt;'');

  v_title := v_kind || '' · '' || v_name;
  v_body  := ''<b>'' || v_kind || ''</b><br/>来客：'' || v_name || ''<br/>内容：'' || v_text
             || ''<br/><br/><span style="color:#888">打开后台回复：zangxiaohei.github.io/zangxiaoheih.github.io/admin-app/</span>'';

  perform net.http_post(
    url     := ''https://www.pushplus.plus/send'',
    headers := jsonb_build_object(''Content-Type'', ''application/json''),
    body    := jsonb_build_object(
                 ''token'',    v_token,
                 ''title'',    v_title,
                 ''content'',  v_body,
                 ''template'', ''html''
               ),
    timeout_milliseconds := 5000
  );

  return new;

exception when others then
  -- 推送失败绝不能影响客户提交留言
  return new;
end;
';

-- ---------- 挂到两张表上 ----------
drop trigger if exists trg_zt_wechat_notify_msg on public.messages;
create trigger trg_zt_wechat_notify_msg
after insert on public.messages
for each row execute function public.zt_wechat_notify();

drop trigger if exists trg_zt_wechat_notify_chat on public.chat_messages;
create trigger trg_zt_wechat_notify_chat
after insert on public.chat_messages
for each row execute function public.zt_wechat_notify();

-- ---------- 自检结果 ----------
select
  case when length(coalesce(pushplus_token, '')) > 8
       then '已设置 token：' || left(pushplus_token, 6) || '****（微信通道已开启）'
       else '未设置 token，微信通道关闭' end as 微信推送状态
from public.app_secrets
where id = 1;
