#!/usr/bin/env python3
from pathlib import Path
from io import BytesIO
from PIL import Image
import cairosvg

root = Path(__file__).resolve().parents[1]
source = (root / 'public/icons/icon.svg').read_bytes()

def render(size):
    png = cairosvg.svg2png(bytestring=source, output_width=size, output_height=size)
    return Image.open(BytesIO(png)).convert('RGBA')

def padded_icon(size, scale, background):
    canvas = Image.new('RGBA', (size, size), background)
    logo = render(size)
    target = round(size * scale)
    logo = logo.resize((target, target), Image.Resampling.LANCZOS)
    canvas.alpha_composite(logo, ((size-target)//2, (size-target)//2))
    return canvas

icons = root / 'public/icons'
icons.mkdir(parents=True, exist_ok=True)
render(192).save(icons / 'icon-192.png', optimize=True)
render(512).save(icons / 'icon-512.png', optimize=True)
padded_icon(512, .76, '#1f274b').save(icons / 'maskable-512.png', optimize=True)

android_icons = root / 'android/res/mipmap-xxxhdpi'
android_icons.mkdir(parents=True, exist_ok=True)
padded_icon(192, .80, '#1f274b').save(android_icons / 'ic_launcher.png', optimize=True)
print('RSATU FZO icons created from public/icons/icon.svg')
