package ru.ivan.myclasses;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.InputStream;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

final class PreparationRepository {
    private PreparationRepository() {}
    static JSONObject defaults(Context c) throws Exception {
        try (InputStream input = c.getAssets().open("packing-defaults.json")) {
            return new JSONObject(ScheduleRepository.readText(input));
        }
    }
    static synchronized JSONObject load(Context c) throws Exception {
        return new JSONObject(ScheduleRepository.prefs(c).getString("preparations", "{}"));
    }
    static synchronized void save(Context c, JSONObject plan) throws Exception {
        String date = checkedDate(plan.getString("date"));
        JSONArray items = plan.getJSONArray("items"), checked = new JSONArray();
        if (items.length() > 60) throw new IllegalArgumentException("В списке может быть до 60 вещей");
        Set<String> ids = new HashSet<>();
        for (int i=0; i<items.length(); i++) {
            JSONObject item = items.getJSONObject(i);
            String id=item.getString("id"), label=item.getString("label").trim();
            if (!id.matches("[a-zA-Z0-9_-]{1,80}") || !ids.add(id)) throw new IllegalArgumentException("Некорректный ID вещи");
            if (label.isEmpty() || label.length()>180) throw new IllegalArgumentException("Название вещи: от 1 до 180 символов");
            checked.put(new JSONObject().put("id",id).put("label",label).put("checked",item.optBoolean("checked")));
        }
        JSONObject plans=load(c);
        plans.put(date,checked);
        if (!ScheduleRepository.prefs(c).edit().putString("preparations",plans.toString()).commit())
            throw new IllegalStateException("Не удалось сохранить список");
    }
    static synchronized void reset(Context c, String date) throws Exception {
        JSONObject plans=load(c); plans.remove(checkedDate(date));
        if (!ScheduleRepository.prefs(c).edit().putString("preparations",plans.toString()).commit())
            throw new IllegalStateException("Не удалось обновить список");
    }
    private static String checkedDate(String date) {
        LocalDate parsed=LocalDate.parse(date);
        if (!date.equals(parsed.toString()) || parsed.getYear()<2000 || parsed.getYear()>2100)
            throw new IllegalArgumentException("Некорректная дата");
        return date;
    }
    static JSONArray lessonsFor(Context c, String date) throws Exception {
        JSONArray all=ScheduleRepository.load(c).getJSONArray("lessons");
        java.util.List<JSONObject> matching=new java.util.ArrayList<>();
        for (int i=0; i<all.length(); i++) {
            JSONObject lesson=all.getJSONObject(i);
            if (date.equals(lesson.optString("date")) && !lesson.optBoolean("cancelled")) matching.add(lesson);
        }
        java.util.Collections.sort(matching,(a,b)->Integer.compare(a.optInt("slot"),b.optInt("slot")));
        return new JSONArray(matching);
    }
    static JSONArray itemsFor(Context c, String date) throws Exception {
        JSONArray saved=load(c).optJSONArray(date);
        if (saved!=null) return saved;
        JSONObject config=defaults(c);
        JSONArray result=new JSONArray(), general=config.getJSONArray("general"), rules=config.getJSONArray("subjects");
        JSONArray lessons=lessonsFor(c,date);
        if (lessons.length()==0) return result;
        for (int i=0; i<general.length(); i++) result.put(defaultItem(general.getJSONObject(i)));
        StringBuilder subjects=new StringBuilder();
        for (int i=0; i<lessons.length(); i++) subjects.append(lessons.getJSONObject(i).getString("subject").toLowerCase(Locale.ROOT)).append('\n');
        for (int i=0; i<rules.length(); i++) {
            JSONObject rule=rules.getJSONObject(i); JSONArray matches=rule.getJSONArray("matches");
            for (int j=0; j<matches.length(); j++) if (subjects.toString().contains(matches.getString(j))) {
                result.put(defaultItem(rule)); break;
            }
        }
        return result;
    }
    private static JSONObject defaultItem(JSONObject item) throws Exception {
        return new JSONObject().put("id",item.getString("id")).put("label",item.getString("label")).put("checked",false);
    }
}
