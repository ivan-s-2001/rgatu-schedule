#!/usr/bin/env python3
import collections
import datetime as dt
import json
import pathlib
import re

root = pathlib.Path(__file__).resolve().parents[1]
data = json.loads((root / "app/src/main/assets/schedule.json").read_text())
lessons = data["lessons"]
assert data["group"] == "ЗВС-26" and data["timezone"] == "Europe/Moscow"
assert len(lessons) == 48
assert collections.Counter(l["date"] for l in lessons) == {
    "2026-10-05": 6, "2026-10-06": 7, "2026-10-07": 6, "2026-10-08": 6,
    "2026-10-09": 6, "2026-10-10": 3, "2026-10-12": 7, "2026-10-13": 3, "2026-10-14": 4,
}
assert len({l["id"] for l in lessons}) == len(lessons)
assert len({(l["date"], l["slot"]) for l in lessons}) == len(lessons)
for lesson in lessons:
    assert 1 <= lesson["slot"] <= 7
    assert lesson["kind"] in ("Л", "П", "ЛР")
    assert lesson["subject"] and lesson["teacher"] and lesson["room"]
    dt.date.fromisoformat(lesson["date"])
assert not any(l["date"] == "2026-10-11" for l in lessons), "Do not fabricate Sunday lessons"
assert next(l for l in lessons if l["id"] == "20261012-2")["room"] == "3-326"
assert next(l for l in lessons if l["id"] == "20261014-4")["room"] == "3-317"
java = (root / "app/src/main/java/ru/ivan/myclasses/TimeRules.java").read_text()
js = (root / "app/src/main/assets/app.js").read_text()
java_times = re.findall(r'\{"(\d\d:\d\d)", "(\d\d:\d\d)"\}', java)
js_times = re.findall(r"\['(\d\d:\d\d)','(\d\d:\d\d)'\]", js)
assert java_times == js_times and len(java_times) == 14, "Native and UI bell tables must agree"
manifest = (root / "app/src/main/AndroidManifest.xml").read_text()
assert "android.permission.INTERNET" not in manifest
for permission in ["POST_NOTIFICATIONS", "SCHEDULE_EXACT_ALARM", "RECEIVE_BOOT_COMPLETED"]:
    assert permission in manifest
for receiver in ["BOOT_COMPLETED", "MY_PACKAGE_REPLACED", "TIME_SET", "TIMEZONE_CHANGED", "SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED"]:
    assert receiver in manifest
print("Schedule: 48 lessons, 9 study days, 14 bell slots, timezone and receiver declarations verified")
