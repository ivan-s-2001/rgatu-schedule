package ru.ivan.myclasses;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

/** Shared planning logic for the Android scheduler and JVM verification. */
public final class ReminderPlan {
    public static final String EVENING_PREFIX = "evening:";
    public static final class Lesson {
        final String id, date;
        final int slot;
        final boolean cancelled, muted;
        public Lesson(String id, String date, int slot, boolean cancelled, boolean muted) {
            this.id=id; this.date=date; this.slot=slot; this.cancelled=cancelled; this.muted=muted;
        }
    }
    public static final class Alarm {
        public final String id;
        public final long time, expected;
        Alarm(String id, long time, long expected) { this.id=id; this.time=time; this.expected=expected; }
    }
    private ReminderPlan() {}

    public static List<Alarm> build(List<Lesson> lessons, long now, int minutes, String eveningTime,
            boolean beforeLessons, boolean evening, Set<String> deliveredDates) {
        List<Alarm> result = new ArrayList<>();
        Set<String> studyDates = new TreeSet<>();
        for (Lesson lesson : lessons) {
            if (lesson.cancelled) continue;
            studyDates.add(lesson.date);
            if (beforeLessons && !lesson.muted) {
                long time = TimeRules.reminderAt(lesson.date, lesson.slot, minutes);
                if (time > now) result.add(new Alarm(lesson.id, time, TimeRules.millis(lesson.date, lesson.slot, false)));
            }
        }
        if (evening) for (String date : studyDates) {
            long time = TimeRules.eveningAt(date, eveningTime);
            if (time > now && !deliveredDates.contains(date)) result.add(new Alarm(EVENING_PREFIX + date, time, time));
        }
        Collections.sort(result, new Comparator<Alarm>() {
            public int compare(Alarm a, Alarm b) {
                int order = Long.compare(a.time, b.time);
                return order != 0 ? order : a.id.compareTo(b.id);
            }
        });
        return new ArrayList<>(result.subList(0, Math.min(200, result.size())));
    }
}
