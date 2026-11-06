-- ============================================================================
-- 一键开启「新留言自动推送到手机」
-- 用法：Supabase Dashboard → SQL Editor → New query → 全文粘贴 → Run
-- 前置条件：已执行过 admin/push-notify.sql（否则下面会提示找不到表/列）
-- 说明：这条 SQL 建了一个每分钟运行一次的定时任务，把新留言交给推送函数发出去。
--       地址和密钥都已在里面填好，不需要你改任何东西。
-- 注意：本脚本刻意不用 $$ 美元符号（防止复制粘贴丢失符号导致语法错误），
--       全部只用普通单引号，可放心整段复制。
-- ============================================================================

-- 0) 启用定时任务扩展 pg_cron + 网络请求扩展 pg_net
--    （报 schema "cron" does not exist 就是因为少了 pg_cron；
--      pg_net 缺了任务能建但每分钟静默失败，两句都要有）
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1) 如果之前建过同名任务，先清掉（没有则删除 0 行，不会报错）
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'notify-push-every-minute';

-- 2) 创建定时任务：每分钟检查一次新留言
--    （任务体用普通单引号字符串，字符串内部的引号全部双写 ''，粘错不了）
SELECT cron.schedule(
  'notify-push-every-minute',
  '* * * * *',
  'SELECT net.http_post(
     url := ''https://ndjctekubqinrlyokmzp.supabase.co/functions/v1/notify-push'',
     headers := jsonb_build_object(
       ''Content-Type'', ''application/json'',
       ''x-notify-secret'', (SELECT notify_shared_secret FROM public.app_secrets WHERE id = 1)
     ),
     body := ''{}''::jsonb
   );'
);

-- 3) 查看任务是否建好（能看到 notify-push-every-minute 一行即成功）
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'notify-push-every-minute';

-- ----------------------------------------------------------------------------
-- 想暂停/关闭推送时，执行这一句即可：
-- SELECT cron.unschedule('notify-push-every-minute');
-- ----------------------------------------------------------------------------
