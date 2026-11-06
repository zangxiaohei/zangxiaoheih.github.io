package com.zhongtian.admin;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
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
    /**
     * v4：v3 的声音是在 try 块里设的，一旦那次调用抛异常，渠道就以「无声」建成，
     * 而渠道属性创建后再也改不了 —— 用户开了发声震动也永远不响。换新 ID 重建。
     */
    static final String CH_UNREAD = "zt_unread_v4";

    private static final int ID_SVC = 1001;      // 前台服务通知
    private static final int ID_UNREAD = 2001;   // 角标通知
    private static final int ID_TEST = 3001;     // 自检用的测试通知
    /* 轮询节奏见 onStartCommand：前台 3 秒、后台 10 秒（1.5 版是固定 60 秒，用户实测要等 30 秒以上） */

    private static final String BASE = "https://ndjctekubqinrlyokmzp.supabase.co/rest/v1/";
    private static final String KEY = "sb_publishable_f_3Lam0m4JQfajKTjuXnMw_GnnWOP-x";

    static final String ACTION_SYNC = "com.zhongtian.admin.SYNC";
    /** 网页把算好的未读数直接推过来，跳过轮询等待 */
    static final String ACTION_PUSH = "com.zhongtian.admin.PUSH";

    /* 供 NativeBridge 读取的诊断状态 */
    static volatile int sTotal = -1;
    static volatile int sMsg = -1;
    static volatile int sChat = -1;
    static volatile String sErr = "";
    static volatile long sLastOk = 0L;
    static volatile int sRounds = 0;
    static volatile boolean sPosted = false;

    private Thread worker;
    private volatile boolean alive = true;
    /** App 是否在前台：MainActivity 的 onResume/onPause 会改这个值，决定轮询快慢 */
    static volatile boolean sForeground = false;
    /* 息屏后手机会进入 Doze：CPU 休眠、网络被冻结，轮询线程直接停住 —— 这就是"息屏收不到"。
       拿着 PARTIAL_WAKE_LOCK 才能让 10 秒一次的轮询在锁屏状态下继续跑 */
    private android.os.PowerManager.WakeLock wake;
    private boolean screenRxOn = false;
    private final android.content.BroadcastReceiver screenRx = new android.content.BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent i) {
            if (Intent.ACTION_SCREEN_OFF.equals(i.getAction())) holdWake();
            else if (Intent.ACTION_SCREEN_ON.equals(i.getAction())) dropWake();
        }
    };
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final SimpleDateFormat hm = new SimpleDateFormat("HH:mm", Locale.CHINA);
    private volatile String lastErr = "";
    private int lastAlertTotal = 0;   // 上次"响过"的未读数，用于只在数字变大时提醒

    @Override
    public void onCreate() {
        super.onCreate();
        ensureChannels();
        startForeground(ID_SVC, serviceNotification(-1, null));
        BootReceiver.schedule(this);   // 挂看门狗：被系统杀掉后自动恢复
        registerScreenReceiver();
        /* 息屏状态启动服务时立刻拿锁；屏幕亮着就不用（亮屏本来就醒着） */
        try {
            android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null && !pm.isInteractive()) holdWake();
        } catch (Throwable ignored) { }
    }

    /* ---------------- 息屏保活：WakeLock ---------------- */

    private void registerScreenReceiver() {
        if (screenRxOn) return;
        try {
            IntentFilter f = new IntentFilter();
            f.addAction(Intent.ACTION_SCREEN_OFF);
            f.addAction(Intent.ACTION_SCREEN_ON);
            f.addAction(Intent.ACTION_USER_PRESENT);
            if (Build.VERSION.SDK_INT >= 33) registerReceiver(screenRx, f, Context.RECEIVER_NOT_EXPORTED);
            else registerReceiver(screenRx, f);
            screenRxOn = true;
        } catch (Throwable ignored) { }
    }

    /** 拿住一把「屏幕关了也让 CPU 醒着」的锁，2 小时自动过期，轮询里会续期 */
    private void holdWake() {
        try {
            if (wake == null) {
                android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE);
                if (pm == null) return;
                wake = pm.newWakeLock(android.os.PowerManager.PARTIAL_WAKE_LOCK, "zt:badge-poll");
                wake.setReferenceCounted(false);
            }
            if (!wake.isHeld()) wake.acquire(2 * 60 * 60 * 1000L);
        } catch (Throwable ignored) { }
    }

    private void dropWake() {
        try { if (wake != null && wake.isHeld()) wake.release(); } catch (Throwable ignored) { }
    }

    private boolean screenOn() {
        try {
            android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE);
            return pm == null || pm.isInteractive();
        } catch (Throwable t) {
            return true;
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_PUSH.equals(intent.getAction())) {
            /* 网页端刚算出的未读数：立刻落到角标，不等下一轮轮询 */
            final int t = intent.getIntExtra("total", -1);
            final int m = intent.getIntExtra("msg", -1);
            final int c = intent.getIntExtra("chat", -1);
            if (t >= 0) {
                ui.post(new Runnable() { @Override public void run() { publish(t, m, c); } });
            }
            return START_STICKY;
        }
        if (intent != null && ACTION_SYNC.equals(intent.getAction())) {
            new Thread(new Runnable() { @Override public void run() { tick(); } }).start();
            return START_STICKY;
        }
        if (worker == null) {
            worker = new Thread(new Runnable() {
                @Override public void run() {
                    while (alive) {
                        /* 息屏时每轮续一次 WakeLock（2 小时过期），长时间锁屏也不会断 */
                        try { if (!screenOn()) holdWake(); } catch (Throwable ignored) { }
                        try { tick(); } catch (Throwable ignored) { }
                        /* 自适应节奏：App 在前台 3 秒一查（接近即时），退到后台 10 秒一查省电 */
                        long wait = sForeground ? 3 : 10;
                        try { Thread.sleep(wait * 1000L); } catch (InterruptedException e) { return; }
                    }
                }
            }, "zt-badge-poll");
            worker.start();
        }
        return START_STICKY;
    }

    /* ---------------- 渠道 ---------------- */

    private void ensureChannels() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;

        /* 作废旧渠道：zt_badge 是 1.4 的错误配置；zt_unread_v2 是"普通重要度"；
           zt_unread_v3 的声音设置写在 try 里，可能以「无声」建成且无法再改 */
        try { nm.deleteNotificationChannel("zt_badge"); } catch (Throwable ignored) { }
        try { nm.deleteNotificationChannel("zt_unread_v2"); } catch (Throwable ignored) { }
        try { nm.deleteNotificationChannel("zt_unread_v3"); } catch (Throwable ignored) { }

        NotificationChannel svc = new NotificationChannel(CH_SVC, "后台运行状态", NotificationManager.IMPORTANCE_MIN);
        svc.setDescription("保持后台监控未读消息的服务提示，不计入桌面角标");
        svc.setShowBadge(false);        // 关键：服务通知绝不能算角标
        svc.setSound(null, null);
        svc.enableVibration(false);
        svc.setLockscreenVisibility(Notification.VISIBILITY_SECRET);
        nm.createNotificationChannel(svc);

        NotificationChannel unread = new NotificationChannel(CH_UNREAD, "新消息（响铃震动）", NotificationManager.IMPORTANCE_HIGH);
        unread.setDescription("有新的客户留言或在线客服消息时弹出横幅、响铃震动，并在桌面图标显示未读数量");
        unread.setShowBadge(true);      // 关键：允许角标
        unread.enableVibration(true);
        unread.enableLights(true);
        unread.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        /* 铃声单独取：取不到就干脆不设（走系统默认），千万别设成 null ——
           设成 null 等于「静音渠道」，而且创建之后永远改不回来 */
        Uri snd = null;
        try { snd = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION); } catch (Throwable ignored) { }
        if (snd != null) {
            try {
                unread.setSound(snd, new android.media.AudioAttributes.Builder()
                        .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
            } catch (Throwable ignored) { }
        }
        unread.setVibrationPattern(new long[]{0, 550, 250, 550});
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
            /* 未读数变多 = 来了新消息 → 允许这次响铃/震动；数字没变则静默更新，避免反复吵 */
            boolean alert = total > lastAlertTotal;
            lastAlertTotal = total;
            /* 关键：同一条通知「原地更新」在小米/澎湃上经常不出声也不震动（系统当成更新而非新消息）。
               有新消息时先撤掉旧的再发新的，强制系统按"新通知"处理，声音和震动才会响。 */
            if (alert && sPosted) nm.cancel(ID_UNREAD);
            nm.notify(ID_UNREAD, unreadNotification(total, msg, chat, alert));
            sPosted = true;
        } else {
            if (total == 0) lastAlertTotal = 0;
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
    private Notification unreadNotification(int total, int msg, int chat, boolean alert) {
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
                .setOnlyAlertOnce(!alert)  // 有新消息时响一次，同数字的重复更新保持安静
                .setNumber(total)          // 官方：桌面角标数字来源
                .setCategory(Notification.CATEGORY_MESSAGE)
                .setColor(0xFF0B6E4F)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setShowWhen(true);
        if (Build.VERSION.SDK_INT >= 26) {
            b.setBadgeIconType(Notification.BADGE_ICON_SMALL);
        }
        /* 双保险：Android 8 以下没有渠道概念，声音震动只能挂在通知本身；
           8 以上由渠道决定，这里设了也会被系统忽略，不影响 */
        if (alert) {
            b.setDefaults(Notification.DEFAULT_SOUND | Notification.DEFAULT_VIBRATE);
            try {
                b.setSound(android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION));
                b.setVibrate(new long[]{0, 550, 250, 550});
            } catch (Throwable ignored) { }
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

    /* ---------------- 自检：立刻响一条，用来分辨「代码没发」还是「手机静音」 ---------------- */

    /**
     * 自检用：立即发一条高重要度通知（带声音 + 震动）。
     * 如果这条也不响，就与角标逻辑无关了 —— 是手机静音/通知音量/勿扰/渠道权限的问题。
     */
    static void postTestAlert(Context ctx) {
        try {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            Notification.Builder b = Build.VERSION.SDK_INT >= 26
                    ? new Notification.Builder(ctx, CH_UNREAD)
                    : new Notification.Builder(ctx);
            b.setSmallIcon(R.drawable.ic_stat)
                    .setContentTitle("测试 · 新消息提醒")
                    .setContentText("这条没声音没震动，就是手机静音 / 通知音量为 0 / 渠道被静音")
                    .setAutoCancel(true)
                    .setCategory(Notification.CATEGORY_MESSAGE)
                    .setNumber(3)
                    .setWhen(System.currentTimeMillis())
                    .setDefaults(Notification.DEFAULT_SOUND | Notification.DEFAULT_VIBRATE);
            try {
                b.setSound(android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION));
                b.setVibrate(new long[]{0, 550, 250, 550});
            } catch (Throwable ignored) { }
            nm.notify(ID_TEST, b.build());
        } catch (Throwable ignored) { }
    }

    /**
     * 更底层的自检：绕过通知系统，直接播放提示音 + 震动。
     * 这一步响了、但上面那条通知不响 → 问题在通知渠道/权限；
     * 这一步也不响 → 手机真的在静音/勿扰，或者通知音量为 0。
     */
    static String playTestSound(Context ctx) {
        StringBuilder r = new StringBuilder();
        try {
            android.media.Ringtone rt = android.media.RingtoneManager.getRingtone(
                    ctx, android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION));
            if (rt == null) r.append("找不到提示音;");
            else {
                if (Build.VERSION.SDK_INT >= 21) {
                    rt.setAudioAttributes(new android.media.AudioAttributes.Builder()
                            .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION)
                            .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build());
                }
                rt.play();
                r.append("已播放提示音;");
            }
        } catch (Throwable t) {
            r.append("播放失败:").append(t.getClass().getSimpleName()).append(';');
        }
        try {
            android.os.Vibrator v = (android.os.Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null || !v.hasVibrator()) r.append("本机无震动马达;");
            else {
                if (Build.VERSION.SDK_INT >= 26) {
                    v.vibrate(android.os.VibrationEffect.createOneShot(600, android.os.VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    v.vibrate(600);
                }
                r.append("已震动;");
            }
        } catch (Throwable t) {
            r.append("震动失败:").append(t.getClass().getSimpleName()).append(';');
        }
        return r.toString();
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
        alive = false;
        if (worker != null) { worker.interrupt(); worker = null; }
        try { if (screenRxOn) unregisterReceiver(screenRx); } catch (Throwable ignored) { }
        screenRxOn = false;
        dropWake();   // 服务销毁必须放锁，否则会一直耗电
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
