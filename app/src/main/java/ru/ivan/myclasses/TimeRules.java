package ru.ivan.myclasses;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;

/** The times are copied from the user's bell-schedule screenshot, including 85-minute slots. */
public final class TimeRules {
    public static final String ZONE = "Europe/Moscow";
    public static final String[][] WEEKDAY = {
        {"08:30", "10:05"}, {"10:15", "11:50"}, {"12:40", "14:15"},
        {"14:25", "16:00"}, {"16:10", "17:45"}, {"18:00", "19:25"}, {"19:35", "21:00"}
    };
    public static final String[][] WEEKEND = {
        {"08:30", "10:05"}, {"10:15", "11:50"}, {"12:00", "13:35"},
        {"13:45", "15:20"}, {"15:30", "17:05"}, {"17:15", "18:40"}, {"18:50", "20:15"}
    };
    private TimeRules() {}

    public static String[] times(String date, int slot) {
        if (slot < 1 || slot > 7) throw new IllegalArgumentException("Номер пары: от 1 до 7");
        return (LocalDate.parse(date).getDayOfWeek().getValue() >= 6 ? WEEKEND : WEEKDAY)[slot - 1];
    }

    public static long millis(String date, int slot, boolean end) {
        return LocalDate.parse(date).atTime(LocalTime.parse(times(date, slot)[end ? 1 : 0]))
            .atZone(ZoneId.of(ZONE)).toInstant().toEpochMilli();
    }

    public static long reminderAt(String date, int slot, int minutes) {
        if (minutes < 0 || minutes > 180) throw new IllegalArgumentException("Интервал: от 0 до 180 минут");
        return millis(date, slot, false) - minutes * 60000L;
    }

    public static String checkEveningTime(String time) {
        LocalTime parsed = LocalTime.parse(time);
        if (!time.matches("\\d{2}:\\d{2}") || !parsed.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")).equals(time))
            throw new IllegalArgumentException("Время должно быть в формате ЧЧ:ММ");
        return time;
    }

    public static long eveningAt(String studyDate, String time) {
        return LocalDate.parse(studyDate).minusDays(1).atTime(LocalTime.parse(checkEveningTime(time)))
            .atZone(ZoneId.of(ZONE)).toInstant().toEpochMilli();
    }

    public static long departureAt(String date, int firstSlot, int travelMinutes) {
        if (travelMinutes < 0 || travelMinutes > 240) throw new IllegalArgumentException("Время на дорогу: от 0 до 240 минут");
        return millis(date, firstSlot, false) - travelMinutes * 60000L;
    }
}
