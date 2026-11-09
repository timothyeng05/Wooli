import sys, numpy as np
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
a = np.asarray(im).astype(int)
fg = np.abs(a-255).sum(2) > 40
xs = [(23,485),(519,982),(1016,1478),(1513,1974),(2007,2458)]
ys = [(26,478),(510,971)]
names = ['today','budget','health','trips','eats','sights','movies','recipes','settings','mail']
S = 512; scale = 4
mask = Image.new('L', (S*scale, S*scale), 0)
ImageDraw.Draw(mask).rounded_rectangle([0,0,S*scale-1,S*scale-1], radius=int(0.225*S*scale), fill=255)
mask = mask.resize((S,S), Image.LANCZOS)
i = 0
for (y0,y1) in ys:
    for (x0,x1) in xs:
        sub = fg[y0-10:y1+10, x0-10:x1+10]
        r = np.where(sub.mean(1) > .5)[0]; c = np.where(sub.mean(0) > .5)[0]
        box = (x0-10+c[0], y0-10+r[0], x0-10+c[-1]+1, y0-10+r[-1]+1)
        # inset slightly so the source's white rounded corners/edge fringe never shows
        ins = 6
        box = (box[0]+ins, box[1]+ins, box[2]-ins, box[3]-ins)
        tile = im.crop(box).resize((S,S), Image.LANCZOS).convert('RGBA')
        tile.putalpha(mask)
        tile.save(f'{out}/icon-{names[i]}.png', optimize=True)
        print(names[i], box)
        i += 1
