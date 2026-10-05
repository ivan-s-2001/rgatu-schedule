#!/usr/bin/env python3
"""Read the supplied workbook without modifying it; preserve source cell provenance."""
import argparse
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path

from openpyxl import load_workbook


def clean(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def parse_lesson(raw, headers):
    text = clean(raw)
    # A shared class can begin with several group identifiers.
    while True:
        match = next((g for g in headers if text == g or text.startswith(g + " ")), None)
        if not match:
            break
        text = text[len(match):].lstrip()
    teacher_match = re.search(r"([А-ЯЁ][а-яё-]+\s+[А-ЯЁ]\.\s*[А-ЯЁ]\.)", text)
    teacher = clean(teacher_match.group(1)) if teacher_match else ""
    before = text[:teacher_match.start()].strip() if teacher_match else text
    room = text[teacher_match.end():].strip() if teacher_match else ""
    kind_match = re.search(r"\s(ЛР|Л|П|К|Зачет|Зачёт|Экзамен|Консультация|Экз\.?|Зач\.?)$", before, re.I)
    kind = kind_match.group(1) if kind_match else ""
    subject = before[:kind_match.start()].strip() if kind_match else before
    return {"subject": subject, "type": kind, "teacher": teacher, "room": room, "raw": clean(raw)}


def import_schedule(path):
    workbook = load_workbook(path, data_only=True)
    sheets = [s for s in workbook if s.title.startswith("Расписание ФЗО")]
    headers = sorted({clean(s.cell(1, c).value) for s in sheets for c in range(4, s.max_column + 1) if s.cell(1, c).value}, key=len, reverse=True)
    groups = []
    lessons = []
    lookup = {}
    occupied = 0
    unparsed = []
    for sheet in sheets:
        dates = sorted({sheet.cell(r, 1).value.date().isoformat() for r in range(2, sheet.max_row + 1) if isinstance(sheet.cell(r, 1).value, datetime)})
        for column in range(4, sheet.max_column + 1):
            group_id = clean(sheet.cell(1, column).value)
            if not group_id:
                continue
            year = int(re.search(r"-(\d{2})", group_id).group(1))
            course = 2026 - (2000 + year) + 1
            group = {"id": group_id, "course": course, "dates": dates, "lessons": []}
            current_date = None
            for row in range(2, sheet.max_row + 1):
                value = sheet.cell(row, 1).value
                if isinstance(value, datetime):
                    current_date = value.date().isoformat()
                cell = sheet.cell(row, column)
                if not cell.value:
                    continue
                occupied += 1
                slot_match = re.search(r"\d+", clean(sheet.cell(row, 3).value))
                if not current_date or not slot_match:
                    raise ValueError(f"Missing date or pair at {sheet.title}!{cell.coordinate}")
                slot = int(slot_match.group())
                # Multiple class entries are separated by line breaks in this format.
                lines = [clean(line) for line in str(cell.value).splitlines() if clean(line)]
                for raw in lines:
                    key = (current_date, slot, raw)
                    if key not in lookup:
                        details = parse_lesson(raw, headers)
                        index = len(lessons)
                        lookup[key] = index
                        lessons.append({"id": index, "date": current_date, "slot": slot, **details, "groups": [], "sources": []})
                        if not details["teacher"]:
                            unparsed.append({"sheet": sheet.title, "cell": cell.coordinate, "raw": raw})
                    index = lookup[key]
                    if group_id not in lessons[index]["groups"]:
                        lessons[index]["groups"].append(group_id)
                    lessons[index]["sources"].append({"sheet": sheet.title, "cell": cell.coordinate})
                    if index not in group["lessons"]:
                        group["lessons"].append(index)
            groups.append(group)
    groups.sort(key=lambda g: (g["course"], g["id"]))
    data = {
        "schema": 1,
        "version": "2026-10-01-" + hashlib.sha256(path.read_bytes()).hexdigest()[:12],
        "updated": "2026-10-01",
        "title": "Осенняя установочная сессия 2026/27",
        "timezone": "Europe/Moscow",
        "source": {"file": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()},
        "groups": groups,
        "lessons": lessons,
    }
    report = {"groups": len(groups), "uniqueLessons": len(lessons), "sourceCells": occupied, "courses": sorted({g["course"] for g in groups}), "unparsed": unparsed}
    assert len(headers) == len(groups), "Group columns lost or duplicated"
    assert sum(len(l["sources"]) for l in lessons) >= occupied, "Source records lost"
    assert all(l["subject"] and 1 <= l["slot"] <= 7 for l in lessons)
    return data, report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--output", type=Path, default=Path("public/schedule.json"))
    args = parser.parse_args()
    data, report = import_schedule(args.workbook)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    full_path = Path("data/schedule-full.json")
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_text(text, encoding="utf-8")
    # Provenance stays in the source package; ship only fields used by the app.
    public_data = {k: v for k, v in data.items() if k != "source"}
    public_data["lessons"] = [{k: v for k, v in lesson.items() if k not in ("groups", "sources", "raw")} for lesson in data["lessons"]]
    public_text = json.dumps(public_data, ensure_ascii=False, separators=(",", ":"))
    args.output.write_text(public_text, encoding="utf-8")
    args.output.with_suffix(".js").write_text("window.RGATU_DATA=" + public_text + ";\n", encoding="utf-8")
    Path("import-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({**report, "unparsed": report["unparsed"][:12], "jsonBytes": len(public_text.encode())}, ensure_ascii=False))


if __name__ == "__main__":
    main()
