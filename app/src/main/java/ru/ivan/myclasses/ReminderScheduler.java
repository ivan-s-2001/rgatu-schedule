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
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

final class ReminderScheduler {
    static final String CHANNEL = "lesson_reminders_v1", EVENING_CHANNEL = "evening_preparation_v1";
    private ReminderScheduler() {}
    static AlarmManager alarms(Context c) { return (AlarmManager)c.getSystemService(Context.ALARM_SERVICE); }
    static NotificationManager notifications(Context c) { return (NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE); }

    static void createChannel(Context c) {
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Перед началом пары", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Предмет, аудитория и время начала занятия");
        channel.enableVibration(true);
        notifications(c).createNotificationChannel(channel);
        NotificationChannel evening = new NotificationChannel(EVENING_CHANNEL, "Подготовка накануне", NotificationManager.IMPORTANCE_DEFAULT);
        evening.setDescription("Завтрашние пары и вещи, которые ещё нужно собрать");
        notifications(c).createNotificationChannel(evening);
    }

    static boolean exactAllowed(Context c) { return Build.VERSION.SDK_INT < 31 || alarms(c).canScheduleExactAlarms(); }
    static boolean notificationsAllowed(Context c) {
        if (Build.VERSION.SDK_INT >= 33 && c.checkSelfPermission("android.permission.POST_NOTIFICATIONS") != android.content.pm.PackageManager.PERMISSION_GRANTED) return false;
        return notifications(c).areNotificationsEnabled();
    }
    static boolean channelAllowed(Context c, String id) {
        if (!notificationsAllowed(c)) return false;
        NotificationChannel channel = notifications(c).getNotificationChannel(id);
        return channel == null || channel.getImportance() != NotificationManager.IMPORTANCE_NONE;
    }
    private static Intent alarmIntent(Context c, String id) {
        Intent intent = new Intent(c, AlarmReceiver.class).setAction("ru.ivan.myclasses.REMIND");
        if (id.startsWith(ReminderPlan.EVENING_PREFIX)) {
            String date=id.substring(ReminderPlan.EVENING_PREFIX.length());
            return intent.setData(Uri.parse("myclasses://preparation-alarm/" + date)).putExtra("preparationDate",date);
        }
        if (id.equals("evening-test:")) return intent.setData(Uri.parse("myclasses://preparation-test")).putExtra("eveningTest",true);
        return intent.setData(Uri.parse("myclasses://alarm/" + id)).putExtra("lessonId",id);
    }
    private static PendingIntent pending(Context c, String id, long expected) {
        return PendingIntent.getBroadcast(c,0,alarmIntent(c,id).putExtra("expectedStart",expected),PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    static synchronized void reschedule(Context c) {
        createChannel(c);
        Set<String> previous=ScheduleRepository.prefs(c).getStringSet("scheduled",Collections.emptySet());
        for (String id : previous) {
            PendingIntent old=PendingIntent.getBroadcast(c,0,alarmIntent(c,id),PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
            if (old!=null) { alarms(c).cancel(old); old.cancel(); }
        }
        Set<String> next=new HashSet<>(); String error="";
        if (notificationsAllowed(c)) try {
            JSONArray all=ScheduleRepository.load(c).getJSONArray("lessons");
            List<ReminderPlan.Lesson> lessons=new ArrayList<>();
            for (int i=0; i<all.length(); i++) {
                JSONObject l=all.getJSONObject(i);
                lessons.add(new ReminderPlan.Lesson(l.getString("id"),l.getString("date"),l.getInt("slot"),l.optBoolean("cancelled"),l.optBoolean("muted")));
            }
            List<ReminderPlan.Alarm> plan=ReminderPlan.build(lessons,System.currentTimeMillis(),ScheduleRepository.prefs(c).getInt("minutes",15),
                ScheduleRepository.prefs(c).getString("eveningTime","20:00"),
                ScheduleRepository.prefs(c).getBoolean("enabled",true) && channelAllowed(c,CHANNEL),
                ScheduleRepository.prefs(c).getBoolean("eveningEnabled",true) && channelAllowed(c,EVENING_CHANNEL),
                ScheduleRepository.prefs(c).getStringSet("eveningDelivered",Collections.emptySet()));
            for (ReminderPlan.Alarm alarm : plan) { schedule(c,alarm.time,pending(c,alarm.id,alarm.expected)); next.add(alarm.id); }
        } catch (Exception exception) { error="Не удалось запланировать все напоминания. Открой приложение ещё раз."; }
        ScheduleRepository.prefs(c).edit().putStringSet("scheduled",next).putString("schedulerError",error).apply();
    }
    static void schedule(Context c, long time, PendingIntent operation) {
        if (exactAllowed(c)) {
            try { alarms(c).setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,time,operation); return; }
            catch (SecurityException revokedDuringCheck) { /* Fall back without crashing. */ }
        }
        alarms(c).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,time,operation);
    }
    static void scheduleTest(Context c, boolean evening) {
        createChannel(c);
        schedule(c,System.currentTimeMillis()+10000,pending(c,evening ? "evening-test:" : "test",0));
    }
    private static Intent open(Context c) {
        return new Intent(c,MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra("navigationToken",Long.toString(System.nanoTime()));
    }
    private static void post(Context c, String channel, int id, Intent open, String title, String text, String expanded, long when) {
        if (!channelAllowed(c,channel)) return;
        PendingIntent content=PendingIntent.getActivity(c,id,open,PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notification=new Notification.Builder(c,channel).setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title).setContentText(text).setStyle(new Notification.BigTextStyle().bigText(expanded))
            .setColor(0xff397b78).setContentIntent(content).setAutoCancel(true).setCategory(Notification.CATEGORY_REMINDER)
            .setWhen(when).setShowWhen(true).build();
        notifications(c).notify(id,notification);
    }
    static void show(Context c, JSONObject lesson, boolean test) throws Exception {
        createChannel(c); Intent open=open(c);
        if (test) {
            post(c,CHANNEL,100,open,"Напоминания работают","Перед парой здесь будут предмет, время и аудитория.","Перед парой здесь будут предмет, время и аудитория.",System.currentTimeMillis()); return;
        }
        String id=lesson.getString("id"),date=lesson.getString("date"); int slot=lesson.getInt("slot");
        long when=TimeRules.millis(date,slot,false),remaining=Math.max(0,(when-System.currentTimeMillis()+59999)/60000);
        String[] times=TimeRules.times(date,slot);
        String text=(remaining>0 ? "Через "+remaining+" мин" : "Пара уже началась")+" · "+times[0]+" · "+lesson.optString("room","");
        String expanded=slot+" пара · "+times[0]+"–"+times[1]+" (Москва)\nАудитория: "+lesson.optString("room","—")+"\n"+lesson.optString("teacher","")+
            (lesson.optString("note","").isEmpty() ? "" : "\n"+lesson.optString("note"));
        open.setData(Uri.parse("myclasses://lesson/"+id)).putExtra("date",date).putExtra("lessonId",id);
        post(c,CHANNEL,id.hashCode(),open,lesson.getString("subject"),text,expanded,when);
    }
    static boolean showPreparation(Context c, String date, boolean test) throws Exception {
        createChannel(c);
        if (!channelAllowed(c,EVENING_CHANNEL)) return false;
        JSONArray lessons=PreparationRepository.lessonsFor(c,date);
        if (lessons.length()==0) return false;
        JSONObject first=lessons.getJSONObject(0),last=lessons.getJSONObject(lessons.length()-1);
        String start=TimeRules.times(date,first.getInt("slot"))[0],end=TimeRules.times(date,last.getInt("slot"))[1];
        List<String> remaining=new ArrayList<>(); JSONArray items=PreparationRepository.itemsFor(c,date);
        for (int i=0; i<items.length(); i++) if (!items.getJSONObject(i).optBoolean("checked")) remaining.add(items.getJSONObject(i).getString("label"));
        String count=lessons.length()==1 ? "1 пара" : lessons.length()<5 ? lessons.length()+" пары" : lessons.length()+" пар";
        String title=test ? "Подготовка к парам · проверка" : "Завтра "+count+" · начало "+start;
        String text=remaining.isEmpty() ? "Всё собрано · "+start+"–"+end : "Не забудь: "+String.join(", ",remaining.subList(0,Math.min(3,remaining.size())));
        StringBuilder expanded=new StringBuilder(LocalDate.parse(date).format(DateTimeFormatter.ofPattern("d MMMM",new Locale("ru")))+" · "+count+" · "+start+"–"+end+" (Москва)");
        int travel=ScheduleRepository.prefs(c).getInt("travelMinutes",-1);
        if (travel>=0) expanded.append("\nВыйти в ").append(java.time.Instant.ofEpochMilli(TimeRules.departureAt(date,first.getInt("slot"),travel)).atZone(ZoneId.of(TimeRules.ZONE)).format(DateTimeFormatter.ofPattern("HH:mm")));
        expanded.append("\n");
        for (int i=0; i<lessons.length(); i++) { JSONObject l=lessons.getJSONObject(i); expanded.append("\n").append(TimeRules.times(date,l.getInt("slot"))[0]).append(" · ").append(l.getString("subject")).append(" · ").append(l.optString("room","")); }
        expanded.append(remaining.isEmpty() ? "\n\nВсё собрано ✓" : "\n\nСобери вечером:");
        for (String label : remaining.subList(0,Math.min(8,remaining.size()))) expanded.append("\n□ ").append(label);
        if (remaining.size()>8) expanded.append("\nЕщё ").append(remaining.size()-8).append(" — открой список");
        Intent open=open(c).setData(Uri.parse("myclasses://preparation/"+date)).putExtra("date",date).putExtra("screen","prepare");
        post(c,EVENING_CHANNEL,(ReminderPlan.EVENING_PREFIX+date).hashCode(),open,title,text,expanded.toString(),System.currentTimeMillis());
        return true;
    }
    static void showEveningTest(Context c) throws Exception {
        String today=LocalDate.now(ZoneId.of(TimeRules.ZONE)).toString(),date=null;
        JSONArray all=ScheduleRepository.load(c).getJSONArray("lessons");
        for (int i=0; i<all.length(); i++) {
            JSONObject l=all.getJSONObject(i); String candidate=l.getString("date");
            if (!l.optBoolean("cancelled") && candidate.compareTo(today)>=0 && (date==null || candidate.compareTo(date)<0)) date=candidate;
        }
        if (date!=null) showPreparation(c,date,true);
        else post(c,EVENING_CHANNEL,101,open(c),"Вечерние уведомления работают","Добавь будущие пары, чтобы получать список накануне.","Добавь будущие пары, чтобы получать список накануне.",System.currentTimeMillis());
    }
}
