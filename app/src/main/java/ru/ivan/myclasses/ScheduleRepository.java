package ru.ivan.myclasses;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

final class ScheduleRepository {
    private static final String PREFS = "my_classes";
    private ScheduleRepository() {}
    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static synchronized JSONObject load(Context context) throws Exception {
        String custom = prefs(context).getString("schedule", null);
        if (custom != null) return new JSONObject(custom);
        try (InputStream input = context.getAssets().open("schedule.json")) {
            return new JSONObject(readText(input));
        }
    }

    static String readText(InputStream input) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[4096];
        int count;
        while ((count = input.read(buffer)) != -1) {
            output.write(buffer, 0, count);
            if (output.size() > 1024 * 1024) throw new IllegalArgumentException("Файл больше 1 МБ");
        }
        return new String(output.toByteArray(), StandardCharsets.UTF_8);
    }

    static JSONObject normalize(JSONObject source) throws Exception {
        if (source.optInt("schemaVersion", 1) != 1) throw new IllegalArgumentException("Неизвестная версия файла");
        String timezone = source.optString("timezone", TimeRules.ZONE);
        if (!TimeRules.ZONE.equals(timezone)) throw new IllegalArgumentException("Нужно расписание по московскому времени");
        JSONArray lessons = source.getJSONArray("lessons");
        if (lessons.length() > 2000) throw new IllegalArgumentException("Не больше 2000 занятий");
        JSONObject normalized = new JSONObject();
        normalized.put("schemaVersion", 1);
        normalized.put("group", limited(source.optString("group", "ЗВС-26"), 40, "Группа"));
        normalized.put("timezone", TimeRules.ZONE);
        normalized.put("source", limited(source.optString("source", "Моё расписание"), 500, "Источник"));
        for (String key : new String[]{"coverageStart", "coverageEnd"}) {
            String value = source.optString(key, "");
            if (!value.isEmpty()) { checkDate(value); normalized.put(key, value); }
        }
        JSONArray dates = source.optJSONArray("sourceDates");
        JSONArray checkedDates = new JSONArray();
        if (dates != null) for (int i = 0; i < dates.length(); i++) {
            String date = dates.getString(i); checkDate(date); checkedDates.put(date);
        }
        normalized.put("sourceDates", checkedDates);
        Set<String> ids = new HashSet<>();
        Set<String> occupied = new HashSet<>();
        JSONArray checked = new JSONArray();
        for (int i = 0; i < lessons.length(); i++) {
            JSONObject original = lessons.getJSONObject(i);
            JSONObject lesson = new JSONObject();
            String id = original.optString("id", UUID.randomUUID().toString());
            if (!id.matches("[a-zA-Z0-9_-]{1,80}") || !ids.add(id))
                throw new IllegalArgumentException("Некорректный или повторяющийся ID занятия");
            String date = original.getString("date"); checkDate(date);
            int slot = original.getInt("slot");
            TimeRules.times(date, slot);
            if (!occupied.add(date + "/" + slot))
                throw new IllegalArgumentException("На эту дату и номер пары уже есть занятие");
            String subject = limited(original.getString("subject"), 180, "Предмет").trim();
            if (subject.isEmpty()) throw new IllegalArgumentException("Укажите предмет");
            String kind = original.optString("kind", "П");
            if (!kind.equals("Л") && !kind.equals("П") && !kind.equals("ЛР"))
                throw new IllegalArgumentException("Тип занятия: Л, П или ЛР");
            lesson.put("id", id).put("date", date).put("slot", slot).put("subject", subject).put("kind", kind);
            lesson.put("teacher", limited(original.optString("teacher", ""), 120, "Преподаватель"));
            lesson.put("room", limited(original.optString("room", ""), 80, "Аудитория"));
            lesson.put("note", limited(original.optString("note", ""), 2000, "Заметка"));
            lesson.put("muted", original.optBoolean("muted", false));
            lesson.put("cancelled", original.optBoolean("cancelled", false));
            checked.put(lesson);
        }
        normalized.put("lessons", checked);
        return normalized;
    }

    private static String limited(String value, int maximum, String field) {
        if (value.length() > maximum) throw new IllegalArgumentException(field + ": слишком длинный текст");
        return value;
    }

    private static void checkDate(String date) {
        LocalDate parsed = LocalDate.parse(date);
        if (parsed.getYear() < 2000 || parsed.getYear() > 2100 || !date.equals(parsed.toString()))
            throw new IllegalArgumentException("Дата должна быть в формате ГГГГ-ММ-ДД, 2000–2100");
    }

    static synchronized void store(Context context, JSONObject schedule) throws Exception {
        if (!prefs(context).edit().putString("schedule", normalize(schedule).toString()).commit())
            throw new IllegalStateException("Не удалось сохранить расписание");
    }

    static synchronized void saveLesson(Context context, JSONObject lesson) throws Exception {
        JSONObject schedule = load(context);
        JSONArray existing = schedule.getJSONArray("lessons");
        JSONArray updated = new JSONArray();
        String id = lesson.optString("id", "");
        if (id.isEmpty()) { id = UUID.randomUUID().toString(); lesson.put("id", id); }
        boolean replaced = false;
        for (int i = 0; i < existing.length(); i++) {
            JSONObject old = existing.getJSONObject(i);
            if (id.equals(old.getString("id"))) { updated.put(lesson); replaced = true; }
            else updated.put(old);
        }
        if (!replaced) updated.put(lesson);
        schedule.put("lessons", updated);
        store(context, schedule);
    }

    static synchronized void deleteLesson(Context context, String id) throws Exception {
        JSONObject schedule = load(context);
        JSONArray updated = new JSONArray(), lessons = schedule.getJSONArray("lessons");
        for (int i = 0; i < lessons.length(); i++) {
            JSONObject lesson = lessons.getJSONObject(i);
            if (!lesson.getString("id").equals(id)) updated.put(lesson);
        }
        schedule.put("lessons", updated); store(context, schedule);
    }

    static JSONObject find(Context context, String id) throws Exception {
        JSONArray lessons = load(context).getJSONArray("lessons");
        for (int i = 0; i < lessons.length(); i++) {
            JSONObject lesson = lessons.getJSONObject(i);
            if (id.equals(lesson.getString("id"))) return lesson;
        }
        return null;
    }
}
