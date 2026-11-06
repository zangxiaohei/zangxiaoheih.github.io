package com.zhongtian.admin;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
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
                o.put("channelBadge", ch != null && ch.getShowBadge());
                o.put("channelImportance", ch == null ? -1 : ch.getImportance());
            } else {
                o.put("channelExists", true);
                o.put("channelBadge", true);
                o.put("channelImportance", 0);
            }
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
        } catch (Exception e) {
            try { o.put("error", String.valueOf(e.getMessage())); } catch (Exception ignored) { }
        }
        return o.toString();
    }

    /** 立刻向服务器查一次未读数（不等 60 秒轮询） */
    @JavascriptInterface
    public void syncNow() {
        try {
            Intent i = new Intent(act, BadgeService.class);
            i.setAction(BadgeService.ACTION_SYNC);
            act.startService(i);
        } catch (Exception ignored) { }
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
