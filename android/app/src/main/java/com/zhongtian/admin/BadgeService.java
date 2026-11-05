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
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * 角标服务：每 60 秒查一次「客户留言 + 在线客服」未读数，
 * 用一条常驻的低优先级通知承载数字 —— 安卓启动器的角标就是跟着通知走的，
 * 这样不依赖浏览器/启动器是否给网页 App 角标权限。
 */
public class BadgeService extends Service {

    private static final String CH_ID = "zt_badge";
    private static final int NOTI_ID = 1001;
    private static final long INTERVAL_SEC = 60;

    private static final String BASE = "https://ndjctekubqinrlyokmzp.supabase.co/rest/v1/";
    private static final String KEY = "sb_publishable_f_3Lam0m4JQfajKTjuXnMw_GnnWOP-x";

    private ScheduledExecutorService pool;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private int lastTotal = -1;

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
        final int chat = count("chat_messages?select=id&is_read=eq.false&role=eq.visitor");
        if (msg < 0 || chat < 0) return;               // 网络失败保留上次结果，别把角标清成 0
        final int total = msg + chat;
        ui.post(new Runnable() {
            @Override public void run() {
                NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                if (nm != null) nm.notify(NOTI_ID, build(msg, chat, total, false));
                /* 厂商角标：小米/华为/荣耀/OPPO/vivo/三星等桌面不认标准通知数字，
                   必须调各家私有接口（ShortcutBadger 内部反射适配）。失败不影响通知栏数字 */
                try { ShortcutBadger.applyCount(BadgeService.this, total); } catch (Exception ignored) { }
                lastTotal = total;
            }
        });
    }

    /** 返回未读条数；-1 表示请求失败 */
    private int count(String path) {
        HttpURLConnection c = null;
        try {
            URL u = new URL(BASE + path);
            c = (HttpURLConnection) u.openConnection();
            c.setConnectTimeout(12000);
            c.setReadTimeout(12000);
            c.setRequestProperty("apikey", KEY);
            c.setRequestProperty("Authorization", "Bearer " + KEY);
            c.setRequestProperty("Accept", "application/json");
            int code = c.getResponseCode();
            if (code != 200) return -1;
            InputStream in = c.getInputStream();
            StringBuilder sb = new StringBuilder();
            BufferedReader br = new BufferedReader(new InputStreamReader(in, "UTF-8"));
            String line;
            while ((line = br.readLine()) != null) sb.append(line);
            br.close();
            return new JSONArray(sb.toString()).length();
        } catch (Exception e) {
            return -1;
        } finally {
            if (c != null) c.disconnect();
        }
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

    private Notification build(int msg, int chat, int total, boolean first) {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) piFlags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, piFlags);

        String title = total > 0 ? "中天后台 · " + total + " 条未读" : "中天后台";
        String text = first ? "正在读取未读消息…"
                : total > 0 ? "客户留言 " + msg + " 条 · 在线客服 " + chat + " 条"
                : "暂无新消息";

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
                .setContentIntent(pi)
                .setNumber(total)                 // 启动器角标显示这个数字
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setOngoing(true)
                .setVisibility(Notification.VISIBILITY_PUBLIC);
        return b.build();
    }

    @Override
    public void onDestroy() {
        if (pool != null) { pool.shutdownNow(); pool = null; }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
