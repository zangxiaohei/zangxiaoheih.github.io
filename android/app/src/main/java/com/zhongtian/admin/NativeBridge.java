package com.zhongtian.admin;

import android.app.AppOpsManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.os.Process;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

import org.json.JSONObject;

/**
 * 网页 ↔ 原生 的状态桥（v1.5）
 * 网页里的「提醒自检」通过它拿到手机端真实状态：通知总开关、角标渠道是否允许、
 * 最近一次原生写入结果、当前桌面（第三方桌面可能不支持角标）。
 * 之前网页自检只能查浏览器的 Notification API，在 App 里必然报"不支持"，纯误导。
 */
public class NativeBridge {

    private final MainActivity act;

    NativeBridge(MainActivity a) { this.act = a; }

    @JavascriptInterface
    public String badgeStatus() {
        JSONObject o = new JSONObject();
        try {
            NotificationManager nm = (NotificationManager) act.getSystemService(Context.NOTIFICATION_SERVICE);
            o.put("platform", "android");
            o.put("version", act.getVersionName());
            o.put("notifyEnabled", nm != null && nm.areNotificationsEnabled());
            if (Build.VERSION.SDK_INT >= 26 && nm != null) {
                NotificationChannel ch = nm.getNotificationChannel(BadgeService.CH_UNREAD);
                o.put("channelExists", ch != null);
                o.put("channelBadge", ch != null && ch.canShowBadge());
                o.put("channelImportance", ch == null ? -1 : ch.getImportance());
                /* 「开了声音震动却不响」的两个真凶就藏在这两行里：
                   渠道的 sound 为 null（等于静音渠道，且创建后无法修改）、
                   或渠道的震动被关掉 */
                o.put("channelSound", ch != null && ch.getSound() != null);
                o.put("channelVibrate", ch != null && ch.shouldVibrate());
            } else {
                o.put("channelExists", true);
                o.put("channelBadge", true);
                o.put("channelImportance", 0);
                o.put("channelSound", true);
                o.put("channelVibrate", true);
            }
            /* 手机整体状态：静音模式 / 勿扰模式 / 通知音量为 0 —— 这三样任何一个成立，
               通知都会「有但不响」，而应用里的开关看起来全是打开的 */
            try {
                android.media.AudioManager am = (android.media.AudioManager) act.getSystemService(Context.AUDIO_SERVICE);
                if (am != null) {
                    o.put("ringerMode", am.getRingerMode());   // 0 静音 / 1 震动 / 2 响铃
                    o.put("notifVolume", am.getStreamVolume(android.media.AudioManager.STREAM_NOTIFICATION));
                    o.put("notifVolumeMax", am.getStreamMaxVolume(android.media.AudioManager.STREAM_NOTIFICATION));
                }
            } catch (Throwable ignored) { }
            try {
                if (Build.VERSION.SDK_INT >= 23 && nm != null) {
                    o.put("dndFilter", nm.getCurrentInterruptionFilter()); // 1=全部允许 2=仅优先 ... 4=完全静默
                }
            } catch (Throwable ignored) { }
            o.put("total", BadgeService.sTotal);
            o.put("msg", BadgeService.sMsg);
            o.put("chat", BadgeService.sChat);
            o.put("posted", BadgeService.sPosted);
            o.put("err", BadgeService.sErr == null ? "" : BadgeService.sErr);
            o.put("lastOk", BadgeService.sLastOk);
            o.put("rounds", BadgeService.sRounds);
            o.put("launcher", launcherName());
            o.put("sdk", Build.VERSION.SDK_INT);
            o.put("device", Build.MANUFACTURER + " " + Build.MODEL);
            o.put("miui", isMiui());
            o.put("autostart", autoStartState(act));
            o.put("batteryUnrestricted", batteryUnrestricted(act));
        } catch (Exception e) {
            try { o.put("error", String.valueOf(e.getMessage())); } catch (Exception ignored) { }
        }
        return o.toString();
    }

    /**
     * 网页把刚算出来的未读数直接推给原生服务（网页每 6 秒刷新一次，比 15 秒轮询更快）。
     * 这样人在 App 里时，来消息 → 角标和通知几乎即时更新。
     */
    @JavascriptInterface
    public void setUnread(int total, int msg, int chat) {
        try {
            Intent i = new Intent(act, BadgeService.class);
            i.setAction(BadgeService.ACTION_PUSH);
            i.putExtra("total", total);
            i.putExtra("msg", msg);
            i.putExtra("chat", chat);
            act.startService(i);
        } catch (Exception ignored) { }
    }

    /** 立刻向服务器查一次未读数（不等 15 秒轮询） */
    @JavascriptInterface
    public void syncNow() {
        try {
            Intent i = new Intent(act, BadgeService.class);
            i.setAction(BadgeService.ACTION_SYNC);
            act.startService(i);
        } catch (Exception ignored) { }
    }

    /** 自检：立刻发一条带声音震动的通知（不动角标，纯测试） */
    @JavascriptInterface
    public void testAlert() {
        BadgeService.postTestAlert(act);
    }

    /** 自检：绕过通知系统直接播放提示音 + 震动，用来分辨是"渠道坏了"还是"手机静音了" */
    @JavascriptInterface
    public String testSound() {
        return BadgeService.playTestSound(act);
    }

    /** 跳到本应用的「新消息」渠道设置页，用户可以在这里把重要度改回「重要」 */
    @JavascriptInterface
    public void openChannelSettings() {
        try {
            Intent i = new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS);
            i.putExtra(Settings.EXTRA_APP_PACKAGE, act.getPackageName());
            i.putExtra(Settings.EXTRA_CHANNEL_ID, BadgeService.CH_UNREAD);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            act.startActivity(i);
        } catch (Throwable t) {
            openNotificationSettings();
        }
    }

    /** 跳到本应用的通知设置：用户能在这里打开「允许通知」和「桌面角标」 */
    @JavascriptInterface
    public void openNotificationSettings() {
        try {
            Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            i.putExtra(Settings.EXTRA_APP_PACKAGE, act.getPackageName());
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            act.startActivity(i);
        } catch (Exception e) {
            openAppSettings();
        }
    }

    @JavascriptInterface
    public void openAppSettings() {
        try {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            i.setData(Uri.parse("package:" + act.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            act.startActivity(i);
        } catch (Exception ignored) { }
    }

    /* ---------------- 自启动 / 省电：国产 ROM 收不到消息的头号原因 ---------------- */

    /** 跳到系统的「自启动管理」页（小米/红米、华为、OPPO、vivo 各自主页） */
    @JavascriptInterface
    public void openAutoStartSettings() {
        if (!jumpAutostart(act)) openAppSettings();
    }

    /** 跳到「省电策略 / 电池优化」页，把本应用设为无限制 */
    @JavascriptInterface
    public void openBatterySettings() {
        if (!jumpBattery(act)) openAppSettings();
    }

    static boolean jumpBattery(Context ctx) {
        try {
            Intent i = new Intent();
            i.setComponent(new ComponentName("com.miui.powerkeeper", "com.miui.powerkeeper.ui.HiddenAppsConfigActivity"));
            i.putExtra("package_name", ctx.getPackageName());
            i.putExtra("package_label", "中天后台");
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
            return true;
        } catch (Throwable ignored) { }
        try {
            Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
            return true;
        } catch (Throwable ignored) { }
        return false;
    }

    static boolean isMiui() {
        String s = (Build.MANUFACTURER + Build.BRAND + Build.DISPLAY).toLowerCase();
        return s.contains("xiaomi") || s.contains("redmi") || s.contains("miui") || s.contains("poco");
    }

    /** 1=已允许 0=被禁止 -1=查不到（不同 ROM 的 op 名不一样，查不到就给按钮让用户自己看） */
    static int autoStartState(Context ctx) {
        String[] ops = {"android:auto_start", "android:auto_start_show", "AUTO_START"};
        AppOpsManager m = (AppOpsManager) ctx.getSystemService(Context.APP_OPS_SERVICE);
        if (m == null) return -1;
        for (String op : ops) {
            try {
                int mode = m.checkOpNoThrow(op, Process.myUid(), ctx.getPackageName());
                if (mode == AppOpsManager.MODE_ALLOWED) return 1;
                if (mode == AppOpsManager.MODE_IGNORED) return 0;
            } catch (Throwable ignored) { }
        }
        return -1;
    }

    static boolean batteryUnrestricted(Context ctx) {
        try {
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            return pm != null && pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
        } catch (Throwable t) {
            return false;
        }
    }

    static boolean jumpAutostart(Context ctx) {
        String[][] targets = {
                {"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"},
                {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
                {"com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"},
                {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
                {"com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"},
                {"com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"},
                {"com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity"}
        };
        for (String[] t : targets) {
            try {
                Intent i = new Intent();
                i.setComponent(new ComponentName(t[0], t[1]));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(i);
                return true;
            } catch (Throwable ignored) { }
        }
        return false;
    }

    private String launcherName() {
        try {
            Intent i = new Intent(Intent.ACTION_MAIN);
            i.addCategory(Intent.CATEGORY_HOME);
            ResolveInfo ri = act.getPackageManager().resolveActivity(i, PackageManager.MATCH_DEFAULT_ONLY);
            return ri == null || ri.activityInfo == null ? "" : ri.activityInfo.packageName;
        } catch (Exception e) {
            return "";
        }
    }
}
