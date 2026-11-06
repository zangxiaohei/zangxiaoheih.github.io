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

    /**
     * 装一次看门狗闹钟；重复调用只是覆盖同一个 PendingIntent，不会堆积。
     *
     * 用 setAndAllowWhileIdle 而不是 setInexactRepeating：息屏进 Doze 之后，
     * 普通闹钟会被推迟到"维护窗口"（可能几十分钟），而 allow-while-idle 的闹钟
     * 在 Doze 里也会照常触发 —— 这是服务被冻结后能自己醒过来的关键。
     */
    /**
     * 划掉任务时的秒级自愈。
     *
     * 用 101 这个独立的 requestCode，避免覆盖掉 5 分钟那只「慢速」看门狗。
     * 设了 stopWithTask=false 之后服务本来就不会随任务移除而停止，正常情况下这段不会被用上；
     * 但国产 ROM 有些会绕过 stopWithTask 直接 kill 进程，这时 1.5 秒后闹钟就会把服务拉回来，
     * 用户基本感觉不到断档。
     */
    static void scheduleSoon(Context ctx, long delayMs) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            Intent i = new Intent(ctx, BootReceiver.class).setAction(ACTION_WATCHDOG);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
            PendingIntent pi = PendingIntent.getBroadcast(ctx, 101, i, flags);
            long at = System.currentTimeMillis() + Math.max(delayMs, 1000L);
            if (Build.VERSION.SDK_INT >= 23) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            } else {
                am.set(AlarmManager.RTC_WAKEUP, at, pi);
            }
        } catch (Exception ignored) { }
    }

    static void schedule(Context ctx) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            Intent i = new Intent(ctx, BootReceiver.class).setAction(ACTION_WATCHDOG);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
            PendingIntent pi = PendingIntent.getBroadcast(ctx, 100, i, flags);
            long next = System.currentTimeMillis() + 5 * 60 * 1000L;
            if (Build.VERSION.SDK_INT >= 23) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi);
            } else {
                am.set(AlarmManager.RTC_WAKEUP, next, pi);
            }
        } catch (Exception ignored) { }
    }
}
