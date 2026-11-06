package com.zhongtian.admin;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import org.json.JSONArray;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * 未读角标服务（按 Android 8.0+ 官方角标模型重写，v1.5）
 *
 * 官方规则（developer.android.com/training/notify-user/badges）：
 *   1. 角标由「活跃通知」驱动：应用图标上有未清除的通知，才会出现红点/数字；
 *   2. ongoing（常驻）通知往往被系统排除在角标之外，前台服务的通知更是如此；
 *   3. 角标开关属于通知渠道属性，渠道一旦创建，setShowBadge 就再也改不了 ——
 *      所以历史版本用过的 zt_badge 渠道永远坏着，必须换新渠道 ID；
 *   4. 数字由 setNumber() 提供，厂商桌面（小米/华为/荣耀/三星/vivo）才显示数字，
 *      原生 Pixel 桌面只显示红点，这是系统差异，不是代码问题。
 *
 * 因此本服务用「两条通知、两个渠道」：
 *   · zt_svc_v2   前台服务通知：IMPORTANCE_MIN + showBadge=false + ongoing，仅保活，不参与角标
 *   · zt_unread_v2 未读通知：IMPORTANCE_DEFAULT + showBadge=true + 非 ongoing + setNumber(N)
 *                  有未读就发、读完就 cancel —— 这才是驱动角标的那个通知
 *
 * 另附厂商私有通道兜底（notification 已能点亮角标时的额外数字写入）。
 */
public class BadgeService extends Service {

    /* 渠道 ID：老渠道 zt_badge 的 showBadge 是错的，且创建后不可修改，只能作废换新 */
    static final String CH_SVC = "zt_svc_v2";
    static final String CH_UNREAD = "zt_unread_v2";

    private static final int ID_SVC = 1001;      // 前台服务通知
    private static final int ID_UNREAD = 2001;   // 角标通知
    private static final long INTERVAL_SEC = 60;

    private static final String BASE = "https://ndjctekubqinrlyokmzp.supabase.co/rest/v1/";
    private static final String KEY = "sb_publishable_f_3Lam0m4JQfajKTjuXnMw_GnnWOP-x";

    static final String ACTION_SYNC = "com.zhongtian.admin.SYNC";

    /* 供 NativeBridge 读取的诊断状态 */
    static volatile int sTotal = -1;
    static volatile int sMsg = -1;
    static volatile int sChat = -1;
    static volatile String sErr = "";
    static volatile long sLastOk = 0L;
    static volatile int sRounds = 0;
    static volatile boolean sPosted = false;

    private ScheduledExecutorService pool;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final SimpleDateFormat hm = new SimpleDateFormat("HH:mm", Locale.CHINA);
    private volatile String lastErr = "";

    @Override
    public void onCreate() {
        super.onCreate();
        ensureChannels();
        startForeground(ID_SVC, serviceNotification(-1, null));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_SYNC.equals(intent.getAction())) {
            new Thread(new Runnable() { @Override public void run() { tick(); } }).start();
            return START_STICKY;
        }
        if (pool == null) {
            pool = Executors.newSingleThreadScheduledExecutor();
            pool.scheduleWithFixedDelay(new Runnable() {
                @Override public void run() { tick(); }
            }, 0, INTERVAL_SEC, TimeUnit.SECONDS);
        }
        return START_STICKY;
    }

    /* ---------------- 渠道 ---------------- */

    private void ensureChannels() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;

        /* 作废旧渠道：它在历史版本里以「IMPORTANCE_LOW + 被当常驻通知」创建，
           角标开关错误且不可修改，留着只会继续误导系统与用户 */
        try { nm.deleteNotificationChannel("zt_badge"); } catch (Throwable ignored) { }

        NotificationChannel svc = new NotificationChannel(CH_SVC, "后台运行状态", NotificationManager.IMPORTANCE_MIN);
        svc.setDescription("保持后台监控未读消息的服务提示，不计入桌面角标");
        svc.setShowBadge(false);        // 关键：服务通知绝不能算角标
        svc.setSound(null, null);
        svc.enableVibration(false);
        svc.setLockscreenVisibility(Notification.VISIBILITY_SECRET);
        nm.createNotificationChannel(svc);

        NotificationChannel unread = new NotificationChannel(CH_UNREAD, "未读消息提醒", NotificationManager.IMPORTANCE_DEFAULT);
        unread.setDescription("有新的客户留言或在线客服消息时，在桌面图标显示未读数量");
        unread.setShowBadge(true);      // 关键：允许角标
        unread.enableVibration(true);
        nm.createNotificationChannel(unread);
    }

    /* ---------------- 轮询 ---------------- */

    private void tick() {
        /* 首选组合 RPC；函数不存在再兜底：留言 RPC + 客服直读。
           messages 表已对匿名收权，必须走 SECURITY DEFINER RPC，不能直读 */
        int total = rpc("app_unread_total");
        int msg = -2, chat = -2;
        if (total < 0) {
            msg = rpc("msg_unread_count");
            chat = msg < 0 ? -1 : count("chat_messages?select=id&is_read=eq.false&role=eq.visitor");
            if (msg < 0 || chat < 0) {
                final String err = lastErr;
                ui.post(new Runnable() {
                    @Override public void run() {
                        sErr = err.isEmpty() ? "未知错误" : err;
                        updateServiceNotification(sTotal, "查询失败：" + sErr);
                    }
                });
                return;
            }
            total = msg + chat;
        }
        final int fTotal = total, fMsg = msg, fChat = chat;
        ui.post(new Runnable() {
            @Override public void run() { publish(fTotal, fMsg, fChat); }
        });
    }

    /** 把未读数落到角标通知上：有未读→发通知（触发角标），无未读→撤销（角标自动消失） */
    private void publish(int total, int msg, int chat) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;

        sTotal = total; sMsg = msg; sChat = chat;
        sErr = ""; sLastOk = System.currentTimeMillis(); sRounds++;

        boolean enabled = notificationsEnabled(nm);
        if (total > 0 && enabled) {
            nm.notify(ID_UNREAD, unreadNotification(total, msg, chat));
            sPosted = true;
        } else {
            nm.cancel(ID_UNREAD);
            sPosted = false;
        }
        applyVendorBadge(total);
        updateServiceNotification(total, enabled ? null : "通知权限已关闭 → 角标无法显示，请到系统设置打开");
    }

    private boolean notificationsEnabled(NotificationManager nm) {
        try { return nm.areNotificationsEnabled(); } catch (Throwable t) { return true; }
    }

    /* ---------------- 通知构造 ---------------- */

    private void updateServiceNotification(int total, String err) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;
        try { nm.notify(ID_SVC, serviceNotification(total, err)); } catch (Throwable ignored) { }
    }

    /** 前台服务通知：常驻、静默、渠道已关闭角标 → 不参与角标计数 */
    private Notification serviceNotification(int total, String err) {
        String text;
        if (err != null) text = err;
        else if (total < 0) text = "正在读取未读消息…";
        else if (total > 0) text = "当前 " + total + " 条未读 · " + hm.format(new Date()) + " 更新";
        else text = "暂无未读 · " + hm.format(new Date()) + " 更新";

        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, CH_SVC)
                : new Notification.Builder(this);
        b.setSmallIcon(R.drawable.ic_stat)
                .setContentTitle("中天后台正在监控消息")
                .setContentText(text)
                .setContentIntent(contentIntent())
                .setOngoing(true)          // 服务通知必须常驻，但渠道 showBadge=false，不影响角标
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setPriority(Notification.PRIORITY_MIN);
        /* 渠道 IMPORTANCE_MIN 本身就静音，无需 setSilent（原生 Builder 没有这个方法） */
        return b.build();
    }

    /** 角标通知：非 ongoing + setNumber + 专属渠道 → 官方认定的角标承载者 */
    private Notification unreadNotification(int total, int msg, int chat) {
        String text = (msg >= 0 && chat >= 0)
                ? "客户留言 " + msg + " 条 · 在线客服 " + chat + " 条，点开查看"
                : "有新的客户消息，点开查看";

        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, CH_UNREAD)
                : new Notification.Builder(this);
        b.setSmallIcon(R.drawable.ic_stat)
                .setContentTitle("中天后台 · " + total + " 条未读")
                .setContentText(text)
                .setContentIntent(contentIntent())
                .setAutoCancel(false)      // 点击不消失；真正读完由服务 cancel
                .setOngoing(false)         // 关键：非常驻，才计入桌面角标
                .setOnlyAlertOnce(true)
                .setNumber(total)          // 官方：桌面角标数字来源
                .setCategory(Notification.CATEGORY_MESSAGE)
                .setColor(0xFF0B6E4F)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setShowWhen(true);
        if (Build.VERSION.SDK_INT >= 26) {
            b.setBadgeIconType(Notification.BADGE_ICON_SMALL);
        }
        Notification n = b.build();

        /* 小米 MIUI / 澎湃OS：桌面数字读 extraNotification.setMessageCount，
           标准 setNumber 在小米上不生效 —— 反射补一刀，其他 ROM 自动跳过 */
        try {
            Field f = Notification.class.getDeclaredField("extraNotification");
            f.setAccessible(true);
            Object extra = f.get(n);
            if (extra != null) {
                Method m = extra.getClass().getDeclaredMethod("setMessageCount", int.class);
                m.setAccessible(true);
                m.invoke(extra, total);
            }
        } catch (Throwable ignored) { }
        return n;
    }

    private PendingIntent contentIntent() {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) piFlags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(this, 0, open, piFlags);
    }

    /* ---------------- 厂商私有通道（通知角标之外的额外写入） ---------------- */

    private void applyVendorBadge(int total) {
        String pkg = getPackageName();
        String cls = MainActivity.class.getName();

        /* 华为 / 荣耀（EMUI、MagicOS）：ContentProvider 直连桌面角标服务 */
        try {
            Bundle b = new Bundle();
            b.putString("package", pkg);
            b.putString("class", cls);
            b.putInt("badgenumber", total);
            getContentResolver().call(
                    Uri.parse("content://com.huawei.android.launcher.settings/badge/"),
                    "change_badge", null, b);
        } catch (Throwable ignored) { }

        /* vivo / iQOO */
        try {
            Intent i = new Intent("launcher.action.CHANGE_APPLICATION_NOTIFICATION_NUM");
            i.putExtra("packageName", pkg);
            i.putExtra("className", cls);
            i.putExtra("notificationNum", total);
            sendBroadcast(i);
        } catch (Throwable ignored) { }

        /* 三星 One UI */
        try {
            Intent i = new Intent("android.intent.action.BADGE_COUNT_UPDATE");
            i.putExtra("badge_count_package_name", pkg);
            i.putExtra("badge_count_class_name", cls);
            i.putExtra("badge_count", total);
            sendBroadcast(i);
        } catch (Throwable ignored) { }
    }

    /* ---------------- 网络 ---------------- */

    /** 调用 SECURITY DEFINER RPC 返回未读数；函数不存在(404)返回 -1 且不记错 */
    private int rpc(String fn) {
        HttpURLConnection c = null;
        lastErr = "";
        try {
            URL u = new URL(BASE + "rpc/" + fn);
            c = (HttpURLConnection) u.openConnection();
            c.setRequestMethod("POST");
            c.setConnectTimeout(12000);
            c.setReadTimeout(12000);
            c.setRequestProperty("apikey", KEY);
            c.setRequestProperty("Authorization", "Bearer " + KEY);
            c.setRequestProperty("Content-Type", "application/json");
            c.setDoOutput(true);
            c.getOutputStream().write("{}".getBytes("UTF-8"));
            int code = c.getResponseCode();
            if (code == 404) { lastErr = ""; return -1; }
            if (code != 200) { lastErr = fn + ": HTTP " + code; return -1; }
            return Integer.parseInt(readAll(c.getInputStream()).trim());
        } catch (NumberFormatException e) {
            lastErr = "";
            return -1;
        } catch (Exception e) {
            String m = e.getMessage();
            lastErr = fn + ": " + e.getClass().getSimpleName() + (m == null ? "" : ":" + m);
            return -1;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private int count(String path) {
        HttpURLConnection c = null;
        lastErr = "";
        try {
            URL u = new URL(BASE + path);
            c = (HttpURLConnection) u.openConnection();
            c.setConnectTimeout(12000);
            c.setReadTimeout(12000);
            c.setRequestProperty("apikey", KEY);
            c.setRequestProperty("Authorization", "Bearer " + KEY);
            c.setRequestProperty("Accept", "application/json");
            int code = c.getResponseCode();
            if (code != 200) {
                InputStream es = c.getErrorStream();
                String body = es == null ? "" : readAll(es);
                lastErr = "HTTP " + code + (body.length() > 60 ? body.substring(0, 60) : body);
                return -1;
            }
            String data = readAll(c.getInputStream());
            lastErr = "";
            return new JSONArray(data).length();
        } catch (Exception e) {
            String m = e.getMessage();
            lastErr = e.getClass().getSimpleName() + (m == null ? "" : ":" + m);
            return -1;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private String readAll(InputStream in) throws Exception {
        StringBuilder sb = new StringBuilder();
        BufferedReader br = new BufferedReader(new InputStreamReader(in, "UTF-8"));
        String line;
        while ((line = br.readLine()) != null) sb.append(line);
        br.close();
        return sb.toString();
    }

    @Override
    public void onDestroy() {
        if (pool != null) { pool.shutdownNow(); pool = null; }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
