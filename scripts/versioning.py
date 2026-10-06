#!/usr/bin/env python3
"""Version policy and consistency checks for the RGATU FZO app."""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION_FILE = ROOT / "version.json"

def load():
    meta = json.loads(VERSION_FILE.read_text(encoding="utf-8"))
    required = ["version","versionCode","channel","released","package","android","artifact","pwa","urls","schedule"]
    missing = [key for key in required if key not in meta]
    if missing:
        raise SystemExit("version.json missing: " + ", ".join(missing))
    if not re.fullmatch(r"\d+\.\d+\.\d+", meta["version"]):
        raise SystemExit("version must be SemVer X.Y.Z")
    if not isinstance(meta["versionCode"], int) or meta["versionCode"] < 1:
        raise SystemExit("versionCode must be a positive integer")
    return meta

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

def check():
    m = load()
    v, code = m["version"], m["versionCode"]
    errors = []

    package = json.loads(read("package.json"))
    if package.get("version") != v:
        errors.append(f"package.json={package.get('version')} expected {v}")

    manifest = read("android/AndroidManifest.xml")
    pairs = {
        "versionName": re.search(r'android:versionName="([^"]+)"', manifest),
        "versionCode": re.search(r'android:versionCode="(\d+)"', manifest),
        "package": re.search(r'package="([^"]+)"', manifest),
        "minSdk": re.search(r'android:minSdkVersion="(\d+)"', manifest),
        "targetSdk": re.search(r'android:targetSdkVersion="(\d+)"', manifest),
    }
    actual = {k:(x.group(1) if x else None) for k,x in pairs.items()}
    expected = {
        "versionName": v,
        "versionCode": str(code),
        "package": m["package"],
        "minSdk": str(m["android"]["minSdk"]),
        "targetSdk": str(m["android"]["targetSdk"]),
    }
    for key in expected:
        if actual[key] != expected[key]:
            errors.append(f"Android {key}={actual[key]} expected {expected[key]}")

    apk_path = ROOT / "docs/download/RgatuLite.apk"
    if not apk_path.exists():
        errors.append("docs/download/RgatuLite.apk is missing")
    else:
        apk_bytes = apk_path.read_bytes()
        apk_sha = hashlib.sha256(apk_bytes).hexdigest()
        if len(apk_bytes) != m["artifact"]["bytes"]:
            errors.append(f"APK bytes={len(apk_bytes)} expected {m['artifact']['bytes']}")
        if apk_sha != m["artifact"]["sha256"]:
            errors.append(f"APK sha256={apk_sha} expected {m['artifact']['sha256']}")

    docs = json.loads(read("docs/version.json"))
    docs_expected = {
        "version": v,
        "versionCode": code,
        "channel": m["channel"],
        "updated": m["released"],
        "download": "./download/" + m["android"]["apk"],
        "sha256": m["artifact"]["sha256"],
        "bytes": m["artifact"]["bytes"],
        "pwa": m["urls"]["pwa"],
    }
    for key,value in docs_expected.items():
        if docs.get(key) != value:
            errors.append(f"docs/version.json {key}={docs.get(key)!r} expected {value!r}")

    page = read("docs/index.html")
    for needle,label in [
        (f'<span class="badge">{v}</span>', "Pages badge"),
        (f'download="RgatuLite-{v}.apk"', "Pages APK filename"),
        (f'<span>Версия {v}</span>', "Pages footer"),
    ]:
        if needle not in page:
            errors.append(label + " is not synced")

    sw = read("public/sw.js")
    if f"const CACHE = '{m['pwa']['cache']}'" not in sw:
        errors.append("PWA cache revision is not synced")

    history = json.loads(read("releases.json"))
    if history.get("current") != v:
        errors.append(f"releases.json current={history.get('current')} expected {v}")
    public = history.get("public") or []
    row = next((x for x in public if x.get("version") == v), None)
    if not row:
        errors.append("current version missing from releases.json")
    else:
        for key,value in [("versionCode",code),("sha256",m["artifact"]["sha256"]),("bytes",m["artifact"]["bytes"])]:
            if row.get(key) != value:
                errors.append(f"releases.json {v} {key} mismatch")

    schedule = json.loads(read("public/schedule.json"))
    for key in ("version","updated"):
        if schedule.get(key) != m["schedule"].get(key):
            errors.append(f"schedule {key}={schedule.get(key)!r} expected {m['schedule'].get(key)!r}")
    if len(schedule.get("groups") or []) != m["schedule"].get("groups"):
        errors.append("schedule group count mismatch")
    if len(schedule.get("lessons") or []) != m["schedule"].get("lessons"):
        errors.append("schedule lesson count mismatch")

    notes = read("RELEASE_NOTES.md").splitlines()
    if not notes or notes[0].strip() != f"Расписание ФЗО {v}":
        errors.append("RELEASE_NOTES.md title is not synced")

    if errors:
        print("VERSION CHECK FAILED")
        for error in errors:
            print(" -", error)
        raise SystemExit(1)
    print(f"VERSION OK: {v} (code {code}, {m['channel']})")
    print(f"APK: {m['artifact']['bytes']} bytes · sha256:{m['artifact']['sha256']}")
    print(f"Schedule: {m['schedule']['version']} · {m['schedule']['groups']} groups · {m['schedule']['lessons']} lessons")

def sync():
    m = load()
    v, code = m["version"], m["versionCode"]

    package_path = ROOT / "package.json"
    package = json.loads(package_path.read_text(encoding="utf-8"))
    package["version"] = v
    package_path.write_text(json.dumps(package,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

    manifest_path = ROOT / "android/AndroidManifest.xml"
    manifest = manifest_path.read_text(encoding="utf-8")
    manifest = re.sub(r'android:versionCode="\d+"', f'android:versionCode="{code}"', manifest, count=1)
    manifest = re.sub(r'android:versionName="[^"]+"', f'android:versionName="{v}"', manifest, count=1)
    manifest_path.write_text(manifest,encoding="utf-8")

    docs = {
        "version": v,
        "versionCode": code,
        "channel": m["channel"],
        "updated": m["released"],
        "download": "./download/" + m["android"]["apk"],
        "sha256": m["artifact"]["sha256"],
        "bytes": m["artifact"]["bytes"],
        "pwa": m["urls"]["pwa"],
    }
    (ROOT/"docs/version.json").write_text(json.dumps(docs,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

    sw_path = ROOT/"public/sw.js"
    sw = sw_path.read_text(encoding="utf-8")
    sw = re.sub(r"const CACHE = '[^']+'", f"const CACHE = '{m['pwa']['cache']}'", sw, count=1)
    sw_path.write_text(sw,encoding="utf-8")

    page_path = ROOT/"docs/index.html"
    page = page_path.read_text(encoding="utf-8")
    page = re.sub(r'<span class="badge">\d+\.\d+\.\d+</span>', f'<span class="badge">{v}</span>', page)
    page = re.sub(r'download="RgatuLite-\d+\.\d+\.\d+\.apk"', f'download="RgatuLite-{v}.apk"', page)
    page = re.sub(r'<span>Версия \d+\.\d+\.\d+</span>', f'<span>Версия {v}</span>', page)
    page_path.write_text(page,encoding="utf-8")

    notes_path = ROOT/"RELEASE_NOTES.md"
    lines = notes_path.read_text(encoding="utf-8").splitlines()
    if lines:
        lines[0] = f"Расписание ФЗО {v}"
        notes_path.write_text("\n".join(lines)+"\n",encoding="utf-8")

    print(f"Synced source metadata to {v} / code {code}")
    check()

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("command",choices=["check","sync"],nargs="?",default="check")
    args=parser.parse_args()
    {"check":check,"sync":sync}[args.command]()

if __name__ == "__main__":
    main()
