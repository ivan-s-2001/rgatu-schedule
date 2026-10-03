#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sdk_root="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
android_jar="${ANDROID_JAR:-$sdk_root/platforms/android-35/android.jar}"
build_tools="${BUILD_TOOLS_DIR:-$sdk_root/build-tools/35.0.1}"
output_dir="$project_root/dist"
work_dir="$project_root/app/build/manual"
if [[ ! -f "$android_jar" || ! -x "$build_tools/aapt2" ]]; then
  printf 'Install Android platform 35 and build-tools 35.0.1, or set ANDROID_JAR and BUILD_TOOLS_DIR.\n' >&2
  exit 1
fi
mkdir -p "$output_dir" "$work_dir/compiled" "$work_dir/generated" "$work_dir/classes" "$work_dir/dex"
"$build_tools/aapt2" compile --dir "$project_root/app/src/main/res" -o "$work_dir/resources.zip"
"$build_tools/aapt2" link -I "$android_jar" --manifest "$project_root/app/src/main/AndroidManifest.xml" \
  -A "$project_root/app/src/main/assets" --java "$work_dir/generated" \
  -o "$work_dir/resources.apk" "$work_dir/resources.zip"
mapfile -t sources < <(find "$project_root/app/src/main/java" "$work_dir/generated" -name '*.java' -print | sort)
java com.sun.tools.javac.Main -encoding UTF-8 -source 8 -target 8 -bootclasspath "$android_jar:$build_tools/core-lambda-stubs.jar" \
  -d "$work_dir/classes" "${sources[@]}"
mapfile -t classes < <(find "$work_dir/classes" -name '*.class' -print | sort)
"$build_tools/d8" --lib "$android_jar" --min-api 26 --output "$work_dir/dex" "${classes[@]}"
python3 "$project_root/scripts/package_apk.py" "$work_dir/resources.apk" "$work_dir/dex" "$work_dir/unsigned.apk"
"$build_tools/zipalign" -f -p 4 "$work_dir/unsigned.apk" "$work_dir/aligned.apk"
if [[ -n "${SCHEDULE_KEYSTORE:-}" ]]; then
  signing_file="$SCHEDULE_KEYSTORE"
  signing_alias="${SCHEDULE_KEY_ALIAS:-rgatu}"
  password_arg="env:SCHEDULE_KEYSTORE_PASSWORD"
else
  signing_file="${SCHEDULE_DEBUG_KEYSTORE:-$project_root/signing/debug.keystore}"
  signing_alias=androiddebugkey
  password_arg=pass:android
  if [[ ! -f "$signing_file" ]]; then
    mkdir -p "$(dirname "$signing_file")"
    keytool -genkeypair -keystore "$signing_file" -storetype PKCS12 -storepass android -keypass android \
      -alias "$signing_alias" -keyalg RSA -keysize 2048 -validity 10000 \
      -dname 'CN=Android Debug, O=Android, C=US' >/dev/null 2>&1
  fi
fi
"$build_tools/apksigner" sign --ks "$signing_file" --ks-key-alias "$signing_alias" \
  --ks-pass "$password_arg" --key-pass "$password_arg" --out "$output_dir/rgatu-schedule.apk" "$work_dir/aligned.apk"
"$build_tools/apksigner" verify --verbose "$output_dir/rgatu-schedule.apk"
"$build_tools/zipalign" -c -p 4 "$output_dir/rgatu-schedule.apk"
printf 'Built %s\n' "$output_dir/rgatu-schedule.apk"
