/* ==========================================================================
   Supabase 连接配置 —— 整个后台唯一需要填的地方
   填法：登录 supabase.com → 你的项目 → Project Settings → API
     ① Project URL      复制到下面 url 的引号里
     ② anon public key  复制到下面 anonKey 的引号里（这个本来就是公开钥匙，安全）
   填好保存，整站与后台即连上数据库；不填则网站照常运行（留言为演示模式）
   ========================================================================== */

window.SUPABASE_CONFIG = {
  url: "https://ndjctekubqinrlyokmzp.supabase.co",
  anonKey: "sb_publishable_f_3Lam0m4JQfajKTjuXnMw_GnnWOP-x"
};
