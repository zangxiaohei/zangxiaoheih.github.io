package com.zhongtian.admin;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * 开机 / 应用更新 / 看门狗闹钟 → 把角标服务拉起来。
 *
 * 除了开机自启，这里还挂了一个 15 分钟的不精确重复闹钟当"看门狗"：
 * 国产 ROM 在内存紧张时会把前台服务杀掉并且不再拉起，有闹钟就能自己恢复。
 * （不精确闹钟不需要额外权限，也不会像精确闹钟那样被 Android 12+ 限制）
 */
public class BootReceiver extends BroadcastReceiver {

    static final String ACTION_WATCHDOG = "com.zhongtian.admin.WATCHDOG";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        try {
            Intent i = new Intent(ctx, BadgeService.class);
            if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i);
            else ctx.startService(i);
        } catch (Exception ignored) { }
        schedule(ctx);
    }

    /** 装一次看门狗闹钟；重复调用只是覆盖同一个 PendingIntent，不会堆积 */
    static void schedule(Context ctx) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            Intent i = new Intent(ctx, BootReceiver.class).setAction(ACTION_WATCHDOG);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
            PendingIntent pi = PendingIntent.getBroadcast(ctx, 100, i, flags);
            am.setInexactRepeating(AlarmManager.RTC_WAKEUP,
                    System.currentTimeMillis() + 10 * 60 * 1000L,
                    15 * 60 * 1000L, pi);
        } catch (Exception ignored) { }
    }
}
