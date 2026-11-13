import sys, numpy as np
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
a = np.asarray(im).astype(int)
fg = np.abs(a-255).sum(2) > 40
def runs(v, minlen=100):
    r=[];s=None
    for i,x in enumerate(v):
        if x and s is None: s=i
        if not x and s is not None:
            if i-s>=minlen: r.append((s,i))
            s=None
    if s is not None: r.append((s,len(v)))
    return r
ys = runs(fg.mean(1) > .3); xs = runs(fg.mean(0) > .3)
assert len(xs)==5 and len(ys)==2, (xs,ys)
names = ['today','trips','eats','sights','movies','recipes','budget','health','settings','mail']
S=512; scale=4
mask = Image.new('L',(S*scale,S*scale),0)
ImageDraw.Draw(mask).rounded_rectangle([0,0,S*scale-1,S*scale-1], radius=int(0.225*S*scale), fill=255)
mask = mask.resize((S,S), Image.LANCZOS)
i=0
for (y0,y1) in ys:
    for (x0,x1) in xs:
        ins=6
        tile = im.crop((x0+ins,y0+ins,x1-ins,y1-ins)).resize((S,S), Image.LANCZOS).convert('RGBA')
        tile.putalpha(mask); tile.save(f'{out}/icon-{names[i]}.png', optimize=True); print(names[i],(x0,y0,x1,y1)); i+=1
