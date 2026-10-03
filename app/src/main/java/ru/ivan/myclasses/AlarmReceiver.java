package ru.ivan.myclasses;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import org.json.JSONObject;

public final class AlarmReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        try {
            String id = intent.getStringExtra("lessonId");
            if ("test".equals(id)) { ReminderScheduler.show(context, null, true); return; }
            if (!ScheduleRepository.prefs(context).getBoolean("enabled", true)) return;
            JSONObject lesson = ScheduleRepository.find(context, id);
            if (lesson == null || lesson.optBoolean("cancelled") || lesson.optBoolean("muted")) return;
            String date = lesson.getString("date");
            int slot = lesson.getInt("slot");
            if (intent.getLongExtra("expectedStart", -1) != TimeRules.millis(date, slot, false)) return;
            if (System.currentTimeMillis() >= TimeRules.millis(date, slot, true)) return;
            ReminderScheduler.show(context, lesson, false);
        } catch (Exception ignored) { /* Bad/stale data never crashes a system receiver. */ }
        finally { ReminderScheduler.reschedule(context); }
    }
}
