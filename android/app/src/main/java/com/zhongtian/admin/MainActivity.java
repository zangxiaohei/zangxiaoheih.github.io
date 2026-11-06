package com.zhongtian.admin;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.KeyEvent;
import android.view.ViewGroup;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * 中天后台上架壳：加载线上后台，自带原生角标通知服务。
 * 用系统 API，不依赖 AndroidX，包体小、构建快。
 */
public class MainActivity extends Activity {

    private static final String HOME_URL =
            "https://zangxiaohei.github.io/zangxiaoheih.github.io/admin-app/index.html";

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private static final int REQ_FILE = 1001;
    private static final int REQ_NOTIFY = 1002;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        /* 给 UA 打标记：网页端据此判断"我在 App 里跑"，自检面板才能显示原生角标状态，
           而不是拿浏览器的 Notification API 误报"不支持" */
        s.setUserAgentString(s.getUserAgentString() + " ZhongtianAdmin/" + getVersionName());

        /* 网页 ↔ 原生桥：读通知权限/角标渠道状态、立刻同步、跳系统通知设置 */
        web.addJavascriptInterface(new NativeBridge(this), "ZTNative");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                Uri u = req.getUrl();
                String scheme = u.getScheme() == null ? "" : u.getScheme();
                // 电话/邮件等交给系统处理，其余（含后台）都在应用内打开，保持登录态
                if (scheme.equals("tel") || scheme.equals("mailto") || scheme.equals("sms")) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                    return true;
                }
                return false;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb,
                                             FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                try {
                    Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    startActivityForResult(Intent.createChooser(i, "选择文件"), REQ_FILE);
                    return true;
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
            }
        });

        setContentView(web, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        web.loadUrl(HOME_URL);

        askNotificationPermission();
        startBadgeService();
        maybePromptAutostart();
    }

    /**
     * 自启动是「可选」项，不强制。
     * 开启的好处：手机重启 / 被系统回收后能自己回来，不用管。
     * 不开也行：只要 App 还在后台就能收消息；代价是重启手机或被清后台后要手动打开一次。
     * 用户明确点过「不再提醒」后永久不再弹，需要时还能从醒示自检里进去开。
     */
    private void maybePromptAutostart() {
        if (!NativeBridge.isMiui()) return;
        SharedPreferences sp = getSharedPreferences("zt", MODE_PRIVATE);
        if (sp.getBoolean("autostart_noask", false)) return;    // 用户说过不想开，就别再问
        if (NativeBridge.autoStartState(this) == 1) return;     // 已经允许了
        if (sp.getBoolean("autostart_asked", false)) return;    // 问过一次就够
        sp.edit().putBoolean("autostart_asked", true)
          .putLong("autostart_at", System.currentTimeMillis()).apply();

        new AlertDialog.Builder(this)
            .setTitle("要不要开启「自启动」？（可选）")
            .setMessage("不开也能用：只要 App 还活着，新消息照样进来（退到桌面后 10 秒内）。\n\n"
                    + "不开的唯一代价：手机重启后，或被系统清掉后，需要你手动打开一次 App 才会继续收。\n\n"
                    + "不想开就点「不再提醒」，以后不再打扰你。")
            .setPositiveButton("去开启", new DialogInterface.OnClickListener() {
                @Override public void onClick(DialogInterface d, int w) {
                    if (!NativeBridge.jumpAutostart(MainActivity.this)) {
                        try {
                            startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                                    Uri.parse("package:" + getPackageName())));
                        } catch (Exception ignored) { }
                    }
                }
            })
            .setNeutralButton("省电设置", new DialogInterface.OnClickListener() {
                @Override public void onClick(DialogInterface d, int w) { NativeBridge.jumpBattery(MainActivity.this); }
            })
            .setNegativeButton("不再提醒", new DialogInterface.OnClickListener() {
                @Override public void onClick(DialogInterface d, int w) {
                    getSharedPreferences("zt", MODE_PRIVATE).edit().putBoolean("autostart_noask", true).apply();
                }
            })
            .show();
    }

    private void askNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFY);
        }
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        if (code == REQ_NOTIFY) startBadgeService();
    }

    String getVersionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "1.5";
        }
    }

    private void startBadgeService() {
        try {
            Intent i = new Intent(this, BadgeService.class);
            if (Build.VERSION.SDK_INT >= 26) startForegroundService(i);
            else startService(i);
        } catch (Exception ignored) { }
    }

    @Override
    protected void onResume() {
        super.onResume();
        BadgeService.sForeground = true;    // 前台：轮询提速到 3 秒，接近即时
        startBadgeService();
        if (web != null) web.onResume();
    }

    @Override
    protected void onPause() {
        BadgeService.sForeground = false;   // 后台：回到 10 秒一次，省电
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ_FILE) {
            if (fileCallback != null) {
                Uri[] out = null;
                if (res == RESULT_OK && data != null && data.getData() != null) {
                    out = new Uri[]{data.getData()};
                }
                fileCallback.onReceiveValue(out);
                fileCallback = null;
            }
            return;
        }
        super.onActivityResult(req, res, data);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && web != null && web.canGoBack()) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.loadUrl("about:blank");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
