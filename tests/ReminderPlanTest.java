import ru.ivan.myclasses.ReminderPlan;
import ru.ivan.myclasses.TimeRules;
import java.time.Instant;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.ArrayList;
import java.util.List;

public final class ReminderPlanTest {
    private static void expect(boolean condition, String message) { if (!condition) throw new AssertionError(message); }
    public static void main(String[] args) {
        List<ReminderPlan.Lesson> lessons=Arrays.asList(
            new ReminderPlan.Lesson("a","2026-10-05",1,false,false),
            new ReminderPlan.Lesson("b","2026-10-05",2,false,true),
            new ReminderPlan.Lesson("c","2026-10-06",1,true,false),
            new ReminderPlan.Lesson("d","2026-10-10",4,false,false));
        long now=Instant.parse("2026-10-03T16:00:00Z").toEpochMilli();
        java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("Europe/Stockholm"));
        expect(Instant.ofEpochMilli(TimeRules.eveningAt("2026-10-05","20:00")).toString().equals("2026-10-04T17:00:00Z"),"Day before in Moscow, even on a phone in Sweden");
        expect(Instant.ofEpochMilli(TimeRules.eveningAt("2027-01-01","00:05")).toString().equals("2026-12-30T21:05:00Z"),"Previous calendar day across a year boundary");
        List<ReminderPlan.Alarm> all=ReminderPlan.build(lessons,now,15,"20:00",true,true,Collections.emptySet());
        expect(all.size()==4,"Two pair alarms and two evening alarms; muted pair still contributes to the daily plan");
        expect(all.get(0).id.equals("evening:2026-10-05"),"First alarm is the preceding evening");
        expect(all.stream().noneMatch(a->a.id.contains("2026-10-06") || a.id.equals("b") || a.id.equals("c")),"Cancelled day and muted pair produce no pair alarm");
        expect(ReminderPlan.build(lessons,now,15,"20:00",false,true,Collections.emptySet()).size()==2,"Evening toggle is independent of the pair toggle");
        expect(ReminderPlan.build(lessons,now,15,"20:00",true,false,Collections.emptySet()).size()==2,"Pair toggle is independent of evening toggle");
        expect(ReminderPlan.build(lessons,now,15,"20:00",false,false,Collections.emptySet()).isEmpty(),"Both disabled cancels all planned reminders");
        List<ReminderPlan.Alarm> afterEvening=ReminderPlan.build(lessons,TimeRules.eveningAt("2026-10-05","20:00"),15,"20:00",true,true,Collections.emptySet());
        expect(afterEvening.size()==3,"Opening after delivery does not replay an expired evening alarm");
        expect(ReminderPlan.build(lessons,now,15,"20:00",false,true,new HashSet<>(Arrays.asList("2026-10-05"))).size()==1,"Clock rollback does not redeliver a recorded date");
        expect(Instant.ofEpochMilli(TimeRules.departureAt("2026-10-10",4,30)).toString().equals("2026-10-10T10:15:00Z"),"Saturday departure uses weekend bells: 13:15 Moscow");
        expect(ReminderPlan.build(lessons,now,15,"19:30",false,true,Collections.emptySet()).get(0).time==TimeRules.eveningAt("2026-10-05","19:30"),"Changing evening time replaces the planned timestamp");
        List<ReminderPlan.Lesson> many=new ArrayList<>();
        for (int i=0;i<400;i++) many.add(new ReminderPlan.Lesson("many-"+i,java.time.LocalDate.parse("2026-10-05").plusDays(i).toString(),1,false,false));
        List<ReminderPlan.Alarm> bounded=ReminderPlan.build(many,now,15,"20:00",true,true,Collections.emptySet());
        expect(bounded.size()==200,"Combined daily and pair queue stays within the device alarm budget");
        for (int i=1;i<bounded.size();i++) expect(bounded.get(i-1).time<=bounded.get(i).time,"Queue must be ordered by delivery time");
        for (String invalid : Arrays.asList("20:00:00","8:00","24:00","oops")) {
            boolean rejected=false; try { TimeRules.checkEveningTime(invalid); } catch (RuntimeException expected) { rejected=true; }
            expect(rejected,"Reject malformed evening time: "+invalid);
        }
        boolean rejected=false; try { TimeRules.departureAt("2026-10-05",1,-1); } catch (IllegalArgumentException expected) { rejected=true; }
        expect(rejected,"Unset travel time cannot silently become a departure calculation");
        System.out.println("ReminderPlan: evening timing, toggles, cancellations, timezone, date deduplication, departure and bounded queue passed");
    }
}
