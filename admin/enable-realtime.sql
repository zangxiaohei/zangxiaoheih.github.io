-- ============================================================================
-- 可选增强：开启"实时推送"（新留言 / 新客服消息 1 秒内自动刷新，不用等 6 秒轮询）
-- 不执行也完全能用：后台每 6 秒自动刷新一次。
-- 用法：Supabase Dashboard → SQL Editor → 全文粘贴 → Run
-- ============================================================================

-- 把两张表加入 Supabase 实时通道（重复执行不报错）
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL;
  END;
END $$;

-- 让实时通道推送"完整行"，前端判断更准确
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
