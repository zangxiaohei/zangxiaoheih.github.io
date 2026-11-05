package com.zhongtian.admin;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** 开机/更新后自动把角标服务拉起来 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        try {
            Intent i = new Intent(ctx, BadgeService.class);
            if (android.os.Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i);
            else ctx.startService(i);
        } catch (Exception ignored) { }
    }
}
