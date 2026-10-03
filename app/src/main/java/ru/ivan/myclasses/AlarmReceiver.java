package ru.ivan.myclasses;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import org.json.JSONObject;

public final class AlarmReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        try {
            if (intent.getBooleanExtra("eveningTest",false)) { ReminderScheduler.showEveningTest(context); return; }
            String preparationDate=intent.getStringExtra("preparationDate");
            if (preparationDate!=null) {
                if (!ScheduleRepository.prefs(context).getBoolean("eveningEnabled",true)) return;
                String time=ScheduleRepository.prefs(context).getString("eveningTime","20:00");
                if (intent.getLongExtra("expectedStart",-1)!=TimeRules.eveningAt(preparationDate,time)) return;
                // A late delivery after midnight must not call today's classes "tomorrow".
                String today=java.time.LocalDate.now(java.time.ZoneId.of(TimeRules.ZONE)).toString();
                if (!java.time.LocalDate.parse(preparationDate).minusDays(1).toString().equals(today)) return;
                java.util.Set<String> delivered=new java.util.HashSet<>(ScheduleRepository.prefs(context).getStringSet("eveningDelivered",java.util.Collections.emptySet()));
                if (delivered.contains(preparationDate)) return;
                if (ReminderScheduler.showPreparation(context,preparationDate,false)) {
                    delivered.add(preparationDate);
                    if (delivered.size()>100) { java.util.List<String> ordered=new java.util.ArrayList<>(delivered); java.util.Collections.sort(ordered); delivered.remove(ordered.get(0)); }
                    ScheduleRepository.prefs(context).edit().putStringSet("eveningDelivered",delivered).commit();
                }
                return;
            }
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
