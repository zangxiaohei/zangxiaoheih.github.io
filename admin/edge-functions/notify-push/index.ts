// ============================================================================
// Supabase Edge Function：notify-push
// 作用：收到调用时，把「新客户留言」通过 Web Push 推到已订阅的手机。
//
// 【傻瓜式部署步骤】见文件末尾「部署四步」，照着点即可。
// 部署成功后，用浏览器打开这个地址能直接看到「已部署成功」的诊断页：
//   https://<项目ref>.supabase.co/functions/v1/notify-push
// ============================================================================

// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import webpush from "npm:web-push@3.6.7";

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
// 兼容新旧两种密钥变量名（Supabase 新项目用 SUPABASE_SECRET_KEY）
const SB_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  "";

// 点通知后打开的后台地址（本项目部署在子路径）
const ADMIN_URL = "https://zangxiaohei.github.io/zangxiaoheih.github.io/admin-app/index.html";

function sbHeaders(extra: Record<string, string> = {}) {
  return { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, ...extra };
}

async function getSecret(name: string): Promise<string | null> {
  if (!SB_KEY) return null;
  const r = await fetch(`${SB_URL}/rest/v1/app_secrets?select=${name}&id=eq.1&limit=1`, {
    headers: sbHeaders(),
  });
  if (!r.ok) return null;
  const rows = await r.json();
  return Array.isArray(rows) && rows[0] ? (rows[0][name] as string) : null;
}

async function rest(path: string, init: RequestInit = {}) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: sbHeaders({
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      ...(init.headers ?? {}),
    }),
  });
}

async function countSubs(): Promise<number | null> {
  if (!SB_KEY) return null;
  const r = await fetch(`${SB_URL}/rest/v1/push_subscriptions?select=id`, {
    headers: sbHeaders({ Prefer: "count=exact", Range: "0-0" }),
  });
  const cr = r.headers.get("content-range"); // 形如 "0-0/2"
  if (cr && cr.includes("/")) return Number(cr.split("/")[1]) || 0;
  try {
    const rows = await r.json();
    return Array.isArray(rows) ? rows.length : null;
  } catch {
    return null;
  }
}

/** 浏览器直接打开时显示的中文诊断页（不需要密钥，方便确认部署是否成功） */
async function healthPage() {
  const shared = await getSecret("notify_shared_secret");
  const vpub = await getSecret("vapid_public");
  const subs = await countSubs();
  const ok = (b: boolean) => (b ? "✅" : "❌");
  const html = `<!DOCTYPE html><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>推送服务状态</title>
  <style>body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#f3f9f6;color:#123;
  margin:0;padding:28px 20px;line-height:1.75}.c{max-width:520px;margin:0 auto;background:#fff;border-radius:16px;
  padding:24px;box-shadow:0 6px 24px rgba(9,60,45,.08)}h1{font-size:19px;margin:0 0 4px}
  .sub{color:#5b7a6d;font-size:13.5px;margin-bottom:18px}.row{display:flex;gap:8px;font-size:14.5px;padding:7px 0;
  border-bottom:1px dashed #e6f0ea}.row:last-child{border:0}.k{color:#5b7a6d;flex:1}code{background:#eef6f1;
  padding:1px 6px;border-radius:5px;font-size:12.5px;word-break:break-all}p.tip{font-size:13px;color:#5b7a6d;
  background:#f7fbf9;border-radius:10px;padding:12px 14px;margin:16px 0 0}</style>
  <div class="c"><h1>✅ 推送函数已部署成功</h1>
  <div class="sub">如果下面几项都是 ✅，说明服务器端一切就绪。</div>
  <div class="row"><span class="k">数据库连接密钥</span><span>${ok(!!SB_KEY)}</span></div>
  <div class="row"><span class="k">推送密钥 VAPID（SQL 是否执行过）</span><span>${ok(!!vpub)}</span></div>
  <div class="row"><span class="k">调用保护密钥</span><span>${ok(!!shared)}</span></div>
  <div class="row"><span class="k">已订阅的手机数量</span><span>${subs === null ? "—" : subs + " 台"}</span></div>
  <p class="tip">手机数量为 0 时：请用手机浏览器打开后台并登录一次，弹出「允许通知」要点允许。<br>
  有任何一项是 ❌：说明 <code>admin/push-notify.sql</code> 还没执行，执行一次即可。</p>
  </div>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

Deno.serve(async (req: Request) => {
  // 浏览器直接打开 → 返回诊断页
  if (req.method === "GET" || req.method === "HEAD") return await healthPage();

  try {
    // 鉴权：只允许携带共享密钥的调用（pg_cron）
    const shared = await getSecret("notify_shared_secret");
    if (!shared || req.headers.get("x-notify-secret") !== shared) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }

    const vPub = await getSecret("vapid_public");
    const vPriv = await getSecret("vapid_private");
    const vSub = (await getSecret("vapid_subject")) || "mailto:admin@example.com";
    if (!vPub || !vPriv) return Response.json({ skipped: "vapid-not-configured" });
    webpush.setVapidDetails(vSub, vPub, vPriv);

    // 1. 取未推送的留言（最多 20 条）
    const q = await rest(
      "messages?select=id,name,phone,content,created_at&pushed_at=is.null&order=created_at.asc&limit=20"
    );
    const rows = await q.json();
    if (!Array.isArray(rows) || rows.length === 0) return Response.json({ sent: 0 });

    // 2. 取所有推送订阅
    const q2 = await rest("push_subscriptions?select=id,endpoint,p256dh,auth");
    const subs: any[] = await q2.json();
    if (!Array.isArray(subs) || subs.length === 0) {
      await markPushed(rows.map((m: any) => m.id));
      return Response.json({ sent: 0, note: "no-subscribers" });
    }

    // 3. 取当前未读总数（随推送一起下发，手机端用它点亮桌面图标红点）
    let unread = rows.length;
    try {
      const uq = await rest("messages?select=id&is_read=eq.false&limit=1000");
      const urows: any[] = await uq.json();
      if (Array.isArray(urows)) unread = urows.length;
    } catch { /* 取不到就退化为本批条数，不影响推送 */ }

    // 4. 逐条推送
    let sent = 0;
    const deadIds: number[] = [];
    for (const m of rows) {
      const payload = JSON.stringify({
        title: "新客户留言",
        body: `${m.name || "客户"}${m.phone ? "（" + m.phone + "）" : ""}：${(m.content || "")
          .replace(/\s+/g, " ")
          .slice(0, 60)}`,
        url: ADMIN_URL,
        tag: `msg-${m.id}`,
        unread: unread,
      });
      for (const s of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 3 * 24 * 3600 }
          );
          sent++;
        } catch (e: any) {
          if (e?.statusCode === 404 || e?.statusCode === 410) deadIds.push(s.id);
        }
      }
    }

    // 4. 清理失效订阅 + 标记已推送
    if (deadIds.length) {
      await rest(`push_subscriptions?id=in.(${deadIds.join(",")})`, { method: "DELETE" });
    }
    await markPushed(rows.map((m: any) => m.id));

    return Response.json({ sent, msgs: rows.length });
  } catch (e: any) {
    return Response.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
});

async function markPushed(ids: any[]) {
  if (!ids.length) return;
  await rest(`messages?id=in.(${ids.join(",")})`, {
    method: "PATCH",
    body: JSON.stringify({ pushed_at: new Date().toISOString() }),
  });
}

// ============================================================================
// 【部署四步】—— 全部在网页上点，不需要装任何软件
//
// ① 登录 supabase.com → 进入你的项目 → 左侧竖排图标里点「Edge Functions」
//    （图标长得像 </>；找不到就在左侧搜索框输入 edge）
// ② 点右上角绿色按钮「Deploy a new function」→ 选「Via Editor」
//    Function name 填：notify-push        ← 必须是这个名字，别改
//    点 Create / Create function
// ③ 编辑器打开 index.ts → 按 Ctrl+A 全选删掉默认内容 → 把本文件从第 1 行到最后
//    全部粘贴进去（含最上面的注释）→ 点右上角「Deploy」按钮，等 10~30 秒
//    ★ 关键：Deploy 面板里如果看到「Verify JWT」/「Enforce JWT verification」开关，
//      务必关掉（Off）。否则定时任务会被拦成 401。
// ④ 部署完成后，用手机或电脑浏览器打开：
//       https://ndjctekubqinrlyokmzp.supabase.co/functions/v1/notify-push
//    能看到一页绿色的「✅ 推送函数已部署成功」就说明成功；
//    如果提示 401 Unauthorized，回到 ③ 把 JWT 开关关掉再 Deploy 一次。
//
// 最后一步：在 SQL Editor 执行 admin/enable-push-cron.sql（一条语句，已填好地址）。
// ============================================================================
