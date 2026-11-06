package com.zhongtian.admin;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.widget.Toast;

/**
 * App 内自动更新：发现新版本 → 下载 → 直接呼起系统安装器。
 *
 * 为什么能覆盖安装而不用卸载：签名是固定的 zt-release.keystore（v1.3 起），
 * 只要包名和签名一致，系统安装器会当成「升级」处理，数据全部保留。
 *
 * 用系统 DownloadManager 而不是自己写 HTTP：
 *   · 断网/切网自动续传，不需要自己维护
 *   · 下完给我们一个 content:// URI，带 FLAG_GRANT_READ_URI_PERMISSION 就能交给安装器
 *     （Android 7 以后禁止 file:// 直接给安装器，自己拼 FileProvider 还要额外的库和 xml）
 */
public class Updater {

    private static final String APK_MIME = "application/vnd.android.package-archive";

    /**
     * 开始更新。返回值用来在网页上给提示：
     *   "downloading"     已开始下载
     *   "need-permission" 需要先去允许「安装未知应用」
     *   "failed"          下载器没起来
     */
    static String start(Activity act, final String url, final int newVersionCode) {
        try {
            /* Android 8 起，非应用商店安装必须由用户给本应用「安装未知应用」授权，
               没授权时安装界面根本不会弹 —— 直接把他送到那个开关页 */
            if (Build.VERSION.SDK_INT >= 26 && !act.getPackageManager().canRequestPackageInstalls()) {
                try {
                    Intent s = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                    s.setData(Uri.parse("package:" + act.getPackageName()));
                    s.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    act.startActivity(s);
                    Toast.makeText(act, "请打开「允许安装此来源的应用」，然后回来再点一次更新",
                            Toast.LENGTH_LONG).show();
                    return "need-permission";
                } catch (Throwable t) {
                    Toast.makeText(act, "请到 设置 → 应用 → 中天后台 → 允许安装未知应用", Toast.LENGTH_LONG).show();
                    return "need-permission";
                }
            }

            final DownloadManager dm = (DownloadManager) act.getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm == null) return "failed";

            String name = "zt-admin-" + newVersionCode + ".apk";
            DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
            r.setTitle("中天后台 " + newVersionCode + " 更新");
            r.setDescription("正在下载安装包…");
            r.setMimeType(APK_MIME);
            r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            r.setDestinationInExternalFilesDir(act, Environment.DIRECTORY_DOWNLOADS, name);
            try {
                r.setAllowedOverMetered(true);
                r.setAllowedOverRoaming(true);
            } catch (Throwable ignored) { }

            final long id = dm.enqueue(r);
            Toast.makeText(act, "开始下载新版本…", Toast.LENGTH_SHORT).show();

            /* 轮询下载状态（下载器没有跨进程回调，轮询最稳），下完直接拉安装器 */
            new Thread(new Runnable() {
                @Override
                public void run() {
                    long deadline = System.currentTimeMillis() + 6 * 60 * 1000L;
                    while (System.currentTimeMillis() < deadline) {
                        try { Thread.sleep(800); } catch (InterruptedException e) { return; }
                        Cursor c = null;
                        try {
                            c = dm.query(new DownloadManager.Query().setFilterById(id));
                            if (c == null || !c.moveToFirst()) continue;
                            int st = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                            if (st == DownloadManager.STATUS_SUCCESSFUL) {
                                Uri apk = dm.getUriForDownloadedFile(id);
                                if (apk != null) {
                                    install(act, apk);
                                } else {
                                    toast(act, "下载完成，但取不到安装包，请到下载目录手动安装");
                                }
                                return;
                            }
                            if (st == DownloadManager.STATUS_FAILED) {
                                int reason = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON));
                                toast(act, "下载失败（" + reason + "），请检查网络后重试");
                                return;
                            }
                        } catch (Throwable ignored) {
                        } finally {
                            if (c != null) c.close();
                        }
                    }
                }
            }, "zt-update-poll").start();

            return "downloading";
        } catch (Throwable t) {
            return "failed";
        }
    }

    /** 呼起系统安装器（签名一致时就是一次普通升级，不会丢数据） */
    private static void install(final Activity act, final Uri apk) {
        act.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    Intent i = new Intent(Intent.ACTION_VIEW);
                    i.setDataAndType(apk, APK_MIME);
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                    act.startActivity(i);
                    Toast.makeText(act, "下载完成，请点「安装」覆盖升级", Toast.LENGTH_LONG).show();
                } catch (Throwable t) {
                    toast(act, "无法呼起安装器，请到文件管理里打开下载的 APK");
                }
            }
        });
    }

    private static void toast(final Activity act, final String msg) {
        act.runOnUiThread(new Runnable() {
            @Override public void run() {
                try { Toast.makeText(act, msg, Toast.LENGTH_LONG).show(); } catch (Throwable ignored) { }
            }
        });
    }
}
