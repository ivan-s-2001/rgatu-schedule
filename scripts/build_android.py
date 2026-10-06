#!/usr/bin/env python3
"""Build a small installable APK with the Android SDK, without Gradle dependencies."""
import argparse
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]

def run(*arguments):
    subprocess.run([str(a) for a in arguments],check=True,cwd=ROOT)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--sdk',default=os.environ.get('ANDROID_SDK_ROOT',os.environ.get('ANDROID_HOME')))
    parser.add_argument('--unsigned',action='store_true',help='Produce aligned bytes for signing in a private environment')
    args = parser.parse_args()
    if not args.sdk:
        parser.error('Pass --sdk /path/to/android-sdk or set ANDROID_SDK_ROOT')
    sdk = Path(args.sdk)
    tools = sdk/'build-tools/34.0.0'
    platform = sdk/'platforms/android-35/android.jar'
    out = ROOT/'build/android'
    if out.exists(): shutil.rmtree(out)
    for folder in ('assets/web','classes','dex','resources'):
        (out/folder).mkdir(parents=True,exist_ok=True)
    for source in (ROOT/'public').rglob('*'):
        if source.is_file() and source.name != 'sw.js':
            destination = out/'assets/web'/source.relative_to(ROOT/'public')
            destination.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(source,destination)
    run(tools/'aapt2','compile','--dir',ROOT/'android/res','-o',out/'resources')
    resources = sorted((out/'resources').glob('*.flat'))
    run(tools/'aapt2','link','-o',out/'base.apk','--manifest',ROOT/'android/AndroidManifest.xml','-I',platform,'-A',out/'assets','--min-sdk-version','26','--target-sdk-version','35',*resources)
    sources = sorted((ROOT/'android/src').rglob('*.java'))
    compiler = ['javac'] if shutil.which('javac') else ['java','-m','jdk.compiler/com.sun.tools.javac.Main']
    run(*compiler,'-encoding','UTF-8','--release','8','-classpath',platform,'-d',out/'classes',*sources)
    classes = sorted((out/'classes').rglob('*.class'))
    run(tools/'d8','--lib',platform,'--min-api','26','--output',out/'dex',*classes)
    with zipfile.ZipFile(out/'base.apk','a',compression=zipfile.ZIP_DEFLATED) as archive:
        archive.write(out/'dex/classes.dex','classes.dex')
    run(tools/'zipalign','-p','-f','4',out/'base.apk',out/'aligned.apk')
    if args.unsigned:
        final = ROOT/'dist/RgatuLite-unsigned.apk'
        final.parent.mkdir(exist_ok=True)
        shutil.copy2(out/'aligned.apk',final)
        print('Unsigned APK:',final,'bytes:',final.stat().st_size)
        return
    signing = ROOT/'android/signing'
    signing.mkdir(exist_ok=True)
    key = signing/'rgatu-pairs.keystore'
    password_file = signing/'password.txt'
    if not key.exists():
        password_file.write_text(secrets.token_urlsafe(30),encoding='utf-8')
        password_file.chmod(0o600)
        run('keytool','-genkeypair','-keystore',key,'-storepass:file',password_file,'-keypass:file',password_file,'-alias','rgatu-pairs','-keyalg','RSA','-keysize','2048','-validity','10000','-dname','CN=RGATU Pairs, O=Student Community, C=RU')
    final = ROOT/'dist/RgatuLite-1.4.3.apk'
    final.parent.mkdir(exist_ok=True)
    run(tools/'apksigner','sign','--ks',key,'--ks-pass','file:'+str(password_file),'--ks-key-alias','rgatu-pairs','--out',final,out/'aligned.apk')
    run(tools/'apksigner','verify','--verbose',final)
    print('APK:',final,'bytes:',final.stat().st_size)

if __name__ == '__main__':
    main()
