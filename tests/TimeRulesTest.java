import ru.ivan.myclasses.TimeRules;
import java.time.Instant;
import java.time.ZoneId;

public final class TimeRulesTest {
    private static void expect(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
    public static void main(String[] args) {
        expect(TimeRules.times("2026-10-05", 3)[0].equals("12:40"), "Weekday third pair");
        expect(TimeRules.times("2026-10-10", 4)[0].equals("13:45"), "Saturday fourth pair");
        expect(TimeRules.times("2026-10-11", 3)[0].equals("12:00"), "Sunday bell rules");
        expect(TimeRules.millis("2026-10-05", 6, true)-TimeRules.millis("2026-10-05", 6, false)==85*60000L, "Weekday sixth pair is 85 minutes");
        expect(TimeRules.millis("2026-10-10", 7, true)-TimeRules.millis("2026-10-10", 7, false)==85*60000L, "Weekend seventh pair is 85 minutes");
        expect(Instant.ofEpochMilli(TimeRules.reminderAt("2026-10-05",1,15)).toString().equals("2026-10-05T05:15:00Z"), "Moscow reminder should be 08:15");
        java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("Europe/Stockholm"));
        expect(Instant.ofEpochMilli(TimeRules.reminderAt("2026-10-05",1,15)).atZone(ZoneId.of("Europe/Moscow")).getHour()==8, "Phone timezone cannot move class");
        expect(TimeRules.reminderAt("2026-10-05",1,0)==TimeRules.millis("2026-10-05",1,false), "Zero-minute reminder");
        expect(TimeRules.reminderAt("2026-10-05",1,180)==TimeRules.millis("2026-10-05",1,false)-180*60000L, "Maximum allowed offset");
        boolean rejected=false; try { TimeRules.times("2026-10-05",8); } catch (IllegalArgumentException expected) { rejected=true; }
        expect(rejected,"Invalid slot must be rejected");
        rejected=false; try { TimeRules.reminderAt("2026-10-05",1,-1); } catch (IllegalArgumentException expected) { rejected=true; }
        expect(rejected,"Negative reminders must be rejected");
        System.out.println("TimeRules: 10 checks passed");
    }
}
