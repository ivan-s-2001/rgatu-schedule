#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]

def calendar(size, maskable=False):
    scale = 4
    canvas = Image.new('RGB', (512*scale,512*scale), '#1f274b')
    draw = ImageDraw.Draw(canvas)
    def box(coords, radius, fill):
        draw.rounded_rectangle(tuple(round(c*scale) for c in coords), radius=radius*scale, fill=fill)
    box((120,128,392,408),28,'#ffffff')
    draw.rectangle((120*scale,182*scale,392*scale,220*scale),fill='#8fd0d8')
    for x in (180,332):
        box((x-12,104,x+12,160),12,'#ffffff')
    for x in (176,278):
        for y in (274,330):
            box((x-11,y-11,x+69,y+11),11,'#1f274b')
    return canvas.resize((size,size),Image.Resampling.LANCZOS)

icons = root/'public/icons'
icons.mkdir(parents=True,exist_ok=True)
for size in (192,512):
    calendar(size).save(icons/f'icon-{size}.png',optimize=True)
calendar(512,True).save(icons/'maskable-512.png',optimize=True)
android_icons = root/'android/res/mipmap-xxxhdpi'
android_icons.mkdir(parents=True,exist_ok=True)
calendar(192).save(android_icons/'ic_launcher.png',optimize=True)
print('Icons created')
