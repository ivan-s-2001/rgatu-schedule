package ru.ivan.myclasses;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

final class ReminderScheduler {
    static final String CHANNEL = "lesson_reminders_v1";
    private ReminderScheduler() {}
    static AlarmManager alarms(Context c) { return (AlarmManager)c.getSystemService(Context.ALARM_SERVICE); }
    static NotificationManager notifications(Context c) { return (NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE); }

    static void createChannel(Context c) {
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Перед началом пары", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Предмет, аудитория и время начала занятия");
        channel.enableVibration(true);
        notifications(c).createNotificationChannel(channel);
    }

    static boolean exactAllowed(Context c) {
        return Build.VERSION.SDK_INT < 31 || alarms(c).canScheduleExactAlarms();
    }

    static boolean notificationsAllowed(Context c) {
        if (Build.VERSION.SDK_INT >= 33 && c.checkSelfPermission("android.permission.POST_NOTIFICATIONS") != android.content.pm.PackageManager.PERMISSION_GRANTED)
            return false;
        if (!notifications(c).areNotificationsEnabled()) return false;
        NotificationChannel channel = notifications(c).getNotificationChannel(CHANNEL);
        return channel == null || channel.getImportance() != NotificationManager.IMPORTANCE_NONE;
    }

    private static Intent alarmIntent(Context c, String id) {
        return new Intent(c, AlarmReceiver.class).setAction("ru.ivan.myclasses.REMIND")
            .setData(Uri.parse("myclasses://alarm/" + id)).putExtra("lessonId", id);
    }

    private static PendingIntent pending(Context c, String id, long start) {
        return PendingIntent.getBroadcast(c, 0, alarmIntent(c, id).putExtra("expectedStart", start),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static synchronized void reschedule(Context c) {
        createChannel(c);
        Set<String> previous = ScheduleRepository.prefs(c).getStringSet("scheduled", Collections.emptySet());
        for (String id : previous) {
            PendingIntent old = PendingIntent.getBroadcast(c, 0, alarmIntent(c, id), PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
            if (old != null) { alarms(c).cancel(old); old.cancel(); }
        }
        Set<String> next = new HashSet<>();
        String error = "";
        if (ScheduleRepository.prefs(c).getBoolean("enabled", true) && notificationsAllowed(c)) {
            try {
                int minutes = ScheduleRepository.prefs(c).getInt("minutes", 15);
                long now = System.currentTimeMillis();
                JSONArray all = ScheduleRepository.load(c).getJSONArray("lessons");
                List<JSONObject> future = new ArrayList<>();
                for (int i = 0; i < all.length(); i++) {
                    JSONObject lesson = all.getJSONObject(i);
                    if (!lesson.optBoolean("cancelled") && !lesson.optBoolean("muted") &&
                        TimeRules.reminderAt(lesson.getString("date"), lesson.getInt("slot"), minutes) > now)
                        future.add(lesson);
                }
                Collections.sort(future, new Comparator<JSONObject>() {
                    public int compare(JSONObject a, JSONObject b) {
                        int order = a.optString("date").compareTo(b.optString("date"));
                        return order != 0 ? order : Integer.compare(a.optInt("slot"), b.optInt("slot"));
                    }
                });
                // Keep below device limits; each delivery refills this window.
                for (JSONObject lesson : future.subList(0, Math.min(200, future.size()))) {
                    String id = lesson.getString("id"), date = lesson.getString("date");
                    int slot = lesson.getInt("slot");
                    long time = TimeRules.reminderAt(date, slot, minutes);
                    PendingIntent operation = pending(c, id, TimeRules.millis(date, slot, false));
                    schedule(c, time, operation);
                    next.add(id);
                }
            } catch (Exception exception) { error = "Не удалось запланировать все напоминания. Откройте приложение ещё раз."; }
        }
        ScheduleRepository.prefs(c).edit().putStringSet("scheduled", next).putString("schedulerError", error).apply();
    }

    static void schedule(Context c, long time, PendingIntent operation) {
        if (exactAllowed(c)) {
            try { alarms(c).setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time, operation); return; }
            catch (SecurityException revokedDuringCheck) { /* Fall back without crashing. */ }
        }
        alarms(c).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time, operation);
    }

    static void scheduleTest(Context c) {
        createChannel(c);
        schedule(c, System.currentTimeMillis() + 10000, pending(c, "test", 0));
    }

    static void show(Context c, JSONObject lesson, boolean test) throws Exception {
        createChannel(c);
        if (!notificationsAllowed(c)) return;
        Intent open = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        String title, text, expanded;
        int notificationId;
        long when;
        if (test) {
            title = "Напоминания работают";
            text = "Перед парой здесь будут предмет, время и аудитория.";
            expanded = text; notificationId = 100; when = System.currentTimeMillis();
        } else {
            String id = lesson.getString("id"), date = lesson.getString("date");
            int slot = lesson.getInt("slot");
            when = TimeRules.millis(date, slot, false);
            long remaining = Math.max(0, (when - System.currentTimeMillis() + 59999) / 60000);
            title = lesson.getString("subject");
            String[] times = TimeRules.times(date, slot);
            text = (remaining > 0 ? "Через " + remaining + " мин" : "Пара уже началась") + " · " + times[0] + " · " + lesson.optString("room", "");
            expanded = slot + " пара · " + times[0] + "–" + times[1] + " (Москва)\n" +
                "Аудитория: " + lesson.optString("room", "—") + "\n" + lesson.optString("teacher", "") +
                (lesson.optString("note", "").isEmpty() ? "" : "\n" + lesson.optString("note"));
            notificationId = id.hashCode();
            open.setData(Uri.parse("myclasses://lesson/" + id)).putExtra("date", date).putExtra("lessonId", id);
        }
        PendingIntent content = PendingIntent.getActivity(c, notificationId, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new Notification.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_notification).setContentTitle(title).setContentText(text)
            .setStyle(new Notification.BigTextStyle().bigText(expanded)).setColor(0xff397b78)
            .setContentIntent(content).setAutoCancel(true).setCategory(Notification.CATEGORY_EVENT)
            .setWhen(when).setShowWhen(true).build();
        notifications(c).notify(notificationId, notification);
    }
}
