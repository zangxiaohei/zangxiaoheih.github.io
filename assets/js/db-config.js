/* ==========================================================================
   Supabase 连接配置 —— 整个后台唯一需要填的地方
   填法：登录 supabase.com → 你的项目 → Project Settings → API
     ① Project URL      复制到下面 url 的引号里
     ② anon public key  复制到下面 anonKey 的引号里（这个本来就是公开钥匙，安全）
   填好保存，整站与后台即连上数据库；不填则网站照常运行（留言为演示模式）
   ========================================================================== */

window.SUPABASE_CONFIG = {
  url: "https://ndjctekubqinrlyokmzp.supabase.co",
  anonKey: "sb_publishable_f_3Lam0m4JQfajKTjuXnMw_GnnWOP-x",
  /* Cloudflare Turnstile 站点密钥（Site Key，公开无妨）。
     留空 = 不启用人机验证；拿到后填进来即可生效（Secret Key 配在数据库 app_secrets 表里） */
  turnstileSiteKey: "",
  /* Web Push 推送公钥（VAPID Public Key，公开无妨）。
     留空 = 不订阅推送（桌面红点仍可用）；配套私钥在数据库 app_secrets 表里 */
  vapidPublicKey: "BMQ7u3AuGx9D-PFB9LUdPnaVtAog_iWdf__TIV9oJVSA0l-TJT6rvYi0cmvf_QycssR3UloH2vEAJiVoeWSWPFw"
};
