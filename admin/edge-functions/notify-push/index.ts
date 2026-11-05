// ============================================================================
// Edge Function: notify-push —— 有新留言时，把 Web Push 推送到管理员手机
//
// 【部署步骤】（约 3 分钟）
// 1. Supabase Dashboard → 左侧 Edge Functions → Create a new function
//    → 选择 "Create a new function"（不选模板）→ 命名 notify-push → Create
// 2. 打开函数 → 把本文件全部代码粘贴进 index.ts（替换默认内容）→ Deploy
// 3. 部署后函数地址形如：
//    https://<项目ref>.supabase.co/functions/v1/notify-push
// 4. 回到 SQL Editor，执行 admin/push-notify.sql 最底部的 cron 语句
//    （把 <EDGE_FUNCTION_URL> 换成第 3 步的地址；共享密钥会自动从数据库取）
// 5. 验证：手机上客户留一条言 → 1 分钟内收到通知横幅、桌面图标出现红点
// ============================================================================

// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import webpush from "npm:web-push@3.6.7";

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// 通知点击后打开的后台地址（本项目部署在子路径）
const ADMIN_URL = "https://zangxiaohei.github.io/zangxiaoheih.github.io/admin.html";

function sbHeaders(extra: Record<string, string> = {}) {
  return { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, ...extra };
}

async function getSecret(name: string): Promise<string | null> {
  const r = await fetch(
    `${SB_URL}/rest/v1/app_secrets?select=${name}&id=eq.1&limit=1`,
    { headers: sbHeaders() }
  );
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

Deno.serve(async (req: Request) => {
  try {
    // 鉴权：只允许携带共享密钥的调用（pg_cron）
    const shared = await getSecret("notify_shared_secret");
    if (!shared || req.headers.get("x-notify-secret") !== shared) {
      return new Response("forbidden", { status: 403 });
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
    if (!Array.isArray(rows) || rows.length === 0) {
      return Response.json({ sent: 0 });
    }

    // 2. 取所有推送订阅
    const q2 = await rest("push_subscriptions?select=id,endpoint,p256dh,auth");
    const subs: any[] = await q2.json();
    if (!Array.isArray(subs) || subs.length === 0) {
      // 没有设备订阅，也要把留言标记为已处理，避免堆积
      await markPushed(rows.map((m: any) => m.id));
      return Response.json({ sent: 0, note: "no-subscribers" });
    }

    // 3. 逐条留言推送
    let sent = 0;
    const deadSubIds: number[] = [];
    for (const m of rows) {
      const payload = JSON.stringify({
        title: "新客户留言",
        body: `${m.name || "客户"}${m.phone ? "（" + m.phone + "）" : ""}：${
          (m.content || "").replace(/\s+/g, " ").slice(0, 60)
        }`,
        url: ADMIN_URL,
        tag: `msg-${m.id}`,
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
          const code = e?.statusCode ?? 0;
          if (code === 404 || code === 410) deadSubIds.push(s.id); // 订阅已失效
        }
      }
    }

    // 4. 清理失效订阅 + 标记已推送
    if (deadSubIds.length) {
      await rest(`push_subscriptions?id=in.(${deadSubIds.join(",")})`, { method: "DELETE" });
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
