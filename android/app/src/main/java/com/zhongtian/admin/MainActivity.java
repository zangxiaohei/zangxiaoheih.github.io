package com.zhongtian.admin;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
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
    private static final int REQ_CAMERA = 1003;      /* 拍完照回来 */
    private static final int REQ_CAM_PERM = 1004;    /* 申请相机权限 */
    private Uri cameraOut;                            /* 本次拍照要写入的 Uri */

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
                /* 网页带 capture 属性的输入框（后台的「拍照」按钮）→ 直接开系统相机；
                   普通「照片」按钮 → 走图库多选。两者 accept 都是 image/*，靠 isCaptureEnabled 区分 */
                boolean image = false;
                String[] accept = params.getAcceptTypes();
                if (accept != null) {
                    for (String a : accept) {
                        if (a != null && a.startsWith("image/")) { image = true; break; }
                    }
                }
                if (image && params.isCaptureEnabled()) {
                    startCamera();
                    return true;
                }
                return pickFile(image);
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

    /* 图库 / 文件选择：图片允许多选（聊天里一次发多张） */
    private boolean pickFile(boolean image) {
        try {
            Intent i = new Intent(Intent.ACTION_GET_CONTENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType(image ? "image/*" : "*/*");
            i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            startActivityForResult(Intent.createChooser(i, image ? "选择图片" : "选择文件"), REQ_FILE);
            return true;
        } catch (Exception e) {
            fileCallback = null;
            return false;
        }
    }

    /* 系统相机：先申请权限，拿到后给相机一个可写的空位 Uri */
    private void startCamera() {
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_CAM_PERM);
            return;
        }
        try {
            cameraOut = newImageUri();
            Intent i = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            if (cameraOut != null) {
                i.putExtra(MediaStore.EXTRA_OUTPUT, cameraOut);
                /* 部分国产 ROM 只认 ClipData 里的授权，两处都给上才稳 */
                i.setClipData(ClipData.newRawUri("", cameraOut));
                i.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            }
            startActivityForResult(i, REQ_CAMERA);
        } catch (Exception e) {
            /* 没有相机 App：退回图库，别让用户点了没反应 */
            cameraOut = null;
            if (!pickFile(true) && fileCallback != null) {
                fileCallback.onReceiveValue(null);
                fileCallback = null;
            }
        }
    }

    /* 拍照输出位置：29+ 用外部媒体库（自己插入的记录不需要存储权限），
       26~28 用内部媒体库，同样免权限，省掉一个读写存储的弹窗 */
    private Uri newImageUri() {
        try {
            ContentValues cv = new ContentValues();
            cv.put(MediaStore.Images.Media.DISPLAY_NAME, "ZT_" + System.currentTimeMillis() + ".jpg");
            cv.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
            Uri base = Build.VERSION.SDK_INT >= 29
                    ? MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                    : MediaStore.Images.Media.INTERNAL_CONTENT_URI;
            return getContentResolver().insert(base, cv);
        } catch (Exception e) {
            return null;
        }
    }

    /* 拍照取消：把占位记录删掉，否则媒体库里会留一张空图 */
    private void dropCameraRow() {
        if (cameraOut == null) return;
        try { getContentResolver().delete(cameraOut, null, null); } catch (Exception ignored) { }
        cameraOut = null;
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
        if (code == REQ_NOTIFY) { startBadgeService(); return; }
        if (code == REQ_CAM_PERM) {
            boolean granted = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED;

            /* 情况 B：网页「拍照」按钮触发的系统相机 */
            if (granted) { startCamera(); return; }
            /* 拒绝了：告诉用户，并把这次文件选择干净地收尾 */
            if (fileCallback != null) { fileCallback.onReceiveValue(null); fileCallback = null; }
            android.widget.Toast.makeText(this, "没有相机权限，可以点「照片」从相册选",
                    android.widget.Toast.LENGTH_LONG).show();
        }
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
        if (req == REQ_CAMERA) {
            Uri out = null;
            if (res == RESULT_OK) {
                if (cameraOut != null) out = cameraOut;
                else if (data != null && data.getData() != null) out = data.getData();
            } else {
                dropCameraRow();
            }
            if (fileCallback != null) {
                fileCallback.onReceiveValue(out == null ? null : new Uri[]{out});
                fileCallback = null;
            }
            cameraOut = null;
            return;
        }
        if (req == REQ_FILE) {
            if (fileCallback != null) {
                Uri[] out = null;
                if (res == RESULT_OK && data != null) {
                    ClipData clip = data.getClipData();
                    if (clip != null && clip.getItemCount() > 0) {
                        out = new Uri[clip.getItemCount()];
                        for (int i = 0; i < clip.getItemCount(); i++) out[i] = clip.getItemAt(i).getUri();
                    } else if (data.getData() != null) {
                        out = new Uri[]{data.getData()};
                    }
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
