-- ============================================================
-- 让 App 能读到「客户留言 + 在线客服」的总未读数（一次性执行）
--
-- 背景：messages / chat_messages 对匿名用户已收权，App 用匿名密钥直读
--       只能拿到 0 条，于是它以为"没有未读"，就永远不发角标通知。
-- 做法：建一个 SECURITY DEFINER 函数，用函数属主的身份统计数量，
--       只返回一个数字，不暴露任何留言内容。
--
-- 注意：本文件全篇没有美元符号，整段复制粘贴不会被吃掉字符。
-- ============================================================

create or replace function public.app_unread_total()
returns int
language sql
security definer
set search_path = public
as 'select (select count(*)::int from public.messages where is_read = false)
         + (select count(*)::int from public.chat_messages where is_read = false and role = ''visitor'')';

grant execute on function public.app_unread_total() to anon, authenticated;

-- 执行完最后这一句会直接返回当前总未读数；
-- 只要不报错，就说明函数建好了（App 60 秒内会自动开始用）
select public.app_unread_total() as total_unread;
