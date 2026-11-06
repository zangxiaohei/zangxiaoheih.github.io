-- ============================================================================
-- 在线客服 · 图片 / 文件收发（在 Supabase「SQL 编辑器」里整块执行一次）
--
-- 作用：建一个公开读的存储桶 chat-files，访客和客服都能上传图片和文件。
--       聊天消息里只存一个链接（不把图片塞进数据库），所以聊天照样很快。
-- 说明：全篇没有 $$、没有变量声明，复制粘贴不会掉字符。
-- ============================================================================

BEGIN;

-- ---------- 1. 建桶：公开读，单文件最大 10 MB ----------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-files', 'chat-files', true, 10485760)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 10485760;

-- ---------- 2. 权限 ----------
-- 上传：访客（anon）和客服（authenticated）都可以
DROP POLICY IF EXISTS chat_files_insert ON storage.objects;
CREATE POLICY chat_files_insert ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'chat-files');

-- 读取：公开桶，但要这个策略才能列目录 / 取签名
DROP POLICY IF EXISTS chat_files_read ON storage.objects;
CREATE POLICY chat_files_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'chat-files');

-- 删除：只给登录后的客服
DROP POLICY IF EXISTS chat_files_delete ON storage.objects;
CREATE POLICY chat_files_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chat-files');

COMMIT;

-- ---------- 自检（应看到：桶 1 个 / 策略 3 条） ----------
SELECT 'bucket' AS item, count(*)::text AS n FROM storage.buckets WHERE id = 'chat-files'
UNION ALL
SELECT 'policy', count(*)::text FROM pg_policies
 WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'chat_files_%';
