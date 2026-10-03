#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
python3 "$project_root/tests/verify_schedule.py"
test_dir="$project_root/app/build/time-tests"
mkdir -p "$test_dir"
java com.sun.tools.javac.Main -encoding UTF-8 -d "$test_dir" \
  "$project_root/app/src/main/java/ru/ivan/myclasses/TimeRules.java" "$project_root/tests/TimeRulesTest.java" \
  "$project_root/app/src/main/java/ru/ivan/myclasses/ReminderPlan.java" "$project_root/tests/ReminderPlanTest.java"
java -cp "$test_dir" TimeRulesTest
java -cp "$test_dir" ReminderPlanTest
