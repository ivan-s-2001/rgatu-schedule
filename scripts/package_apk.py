#!/usr/bin/env python3
"""Combine linked Android resources and dex; signing happens after alignment."""
import pathlib
import sys
import zipfile

resources, dex_dir, target = map(pathlib.Path, sys.argv[1:])
with zipfile.ZipFile(resources) as original, zipfile.ZipFile(target, "w") as result:
    for item in original.infolist():
        result.writestr(item, original.read(item.filename))
    for dex in sorted(dex_dir.glob("*.dex")):
        result.write(dex, dex.name, compress_type=zipfile.ZIP_DEFLATED)
