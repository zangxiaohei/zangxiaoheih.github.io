-- 组合未读数 RPC：客户留言 + 在线客服（安卓 APK 角标服务优先调用此函数）
-- 背景：messages 表已对匿名收权（HTTP 401 42501），直读不可用；
--       此函数为 SECURITY DEFINER，绕过 RLS 返回总数，匿名可执行。
-- 在 Supabase SQL Editor 中运行一次即可。

CREATE OR REPLACE FUNCTION public.app_unread_total() RETURNS int
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT count(*)::int FROM public.messages WHERE is_read = false)
       + (SELECT count(*)::int FROM public.chat_messages WHERE is_read = false AND role = 'visitor');
$$;

GRANT EXECUTE ON FUNCTION public.app_unread_total() TO anon, authenticated;
