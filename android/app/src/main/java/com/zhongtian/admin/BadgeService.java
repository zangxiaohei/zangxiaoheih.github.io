package com.zhongtian.admin;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import org.json.JSONArray;

import me.leolin.shortcutbadger.ShortcutBadger;

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
 * 角标服务：每 60 秒查一次「客户留言 + 在线客服」未读数。
 * 角标两条路同时走：
 *  1) ShortcutBadger —— 各厂商桌面私有接口（小米/华为/OPPO/vivo/三星…）
 *  2) 常驻通知 —— setNumber + 小米 extraNotification.setMessageCount
 * 通知文案自带诊断信息（成功条数/失败原因），方便远程排查。
 */
public class BadgeService extends Service {

    private static final String CH_ID = "zt_badge";
    private static final int NOTI_ID = 1001;
    private static final long INTERVAL_SEC = 60;

    private static final String BASE = "https://ndjctekubqinrlyokmzp.supabase.co/rest/v1/";
    private static final String KEY = "sb_publishable_f_3Lam0m4JQfajKTjuXnMw_GnnWOP-x";

    private ScheduledExecutorService pool;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final SimpleDateFormat hm = new SimpleDateFormat("HH:mm", Locale.CHINA);
    private volatile String lastErr = "";     // 最近一次失败原因（空=成功）
    private int okRounds = 0;                 // 成功轮数（0=从没成功过）

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        startForeground(NOTI_ID, build(0, 0, 0, true));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (pool == null) {
            pool = Executors.newSingleThreadScheduledExecutor();
            pool.scheduleWithFixedDelay(new Runnable() {
                @Override public void run() { tick(); }
            }, 0, INTERVAL_SEC, TimeUnit.SECONDS);
        }
        return START_STICKY;
    }

    private void tick() {
        final int msg = count("messages?select=id&is_read=eq.false");
        final int chat = msg < 0 ? -1
                : count("chat_messages?select=id&is_read=eq.false&role=eq.visitor");
        final String err = lastErr;
        ui.post(new Runnable() {
            @Override public void run() {
                if (msg < 0 || chat < 0) {
                    /* 失败也要把原因显示在通知上，桌面角标保持现状不清零 */
                    NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                    if (nm != null) nm.notify(NOTI_ID, buildErr("查询失败：" + err));
                    return;
                }
                okRounds++;
                final int total = msg + chat;
                NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                if (nm != null) nm.notify(NOTI_ID, build(msg, chat, total, false));
                /* 厂商角标：小米/华为/OPPO/vivo/三星等桌面私有接口 */
                try { ShortcutBadger.applyCount(BadgeService.this, total); } catch (Throwable ignored) { }
            }
        });
    }

    /** 返回未读条数；-1 表示请求失败（原因写入 lastErr） */
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
            InputStream in = c.getInputStream();
            String data = readAll(in);
            int n = new JSONArray(data).length();
            lastErr = "";
            return n;
        } catch (Exception e) {
            String m = e.getMessage();
            lastErr = (e.getClass().getSimpleName()) + (m == null ? "" : ":" + m);
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

    private void createChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel ch = new NotificationChannel(CH_ID, "未读提醒", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("在图标上显示未读留言与客服消息数量");
        ch.setShowBadge(true);          // 关键：允许角标
        ch.enableVibration(false);
        ch.setSound(null, null);
        nm.createNotificationChannel(ch);
    }

    private PendingIntent contentIntent() {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) piFlags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(this, 0, open, piFlags);
    }

    private Notification build(int msg, int chat, int total, boolean first) {
        String title = total > 0 ? "中天后台 · " + total + " 条未读" : "中天后台";
        String text = first ? "正在读取未读消息…"
                : total > 0 ? "留言 " + msg + " + 客服 " + chat + "（" + hm.format(new Date()) + " 更新）"
                : "暂无新消息（" + hm.format(new Date()) + "）";
        return makeNotification(title, text, total);
    }

    private Notification buildErr(String why) {
        return makeNotification("中天后台",
                why + " · 第 " + okRounds + " 次成功后失败（" + hm.format(new Date()) + "）", 0);
    }

    /** 统一组装：标准角标数字 + 小米私有字段 */
    private Notification makeNotification(String title, String text, int total) {
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            b = new Notification.Builder(this, CH_ID);
        } else {
            b = new Notification.Builder(this);
            b.setPriority(Notification.PRIORITY_LOW);
        }
        b.setSmallIcon(R.drawable.ic_stat)
                .setContentTitle(title)
                .setContentText(text)
                .setContentIntent(contentIntent())
                .setNumber(total)                 // 标准接口：原生桌面角标显示这个数字
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setOngoing(true)
                .setVisibility(Notification.VISIBILITY_PUBLIC);
        Notification n = b.build();

        /* 小米(MIUI/澎湃OS)：桌面只认 extraNotification.setMessageCount，
           标准的 setNumber 在小米上无效。反射调用，非小米机型自动跳过 */
        try {
            Field f = n.getClass().getDeclaredField("extraNotification");
            f.setAccessible(true);
            Object extra = f.get(n);
            Method m = extra.getClass().getDeclaredMethod("setMessageCount", int.class);
            m.setAccessible(true);
            m.invoke(extra, total);
        } catch (Throwable ignored) { }
        return n;
    }

    @Override
    public void onDestroy() {
        if (pool != null) { pool.shutdownNow(); pool = null; }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
