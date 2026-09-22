"""Read-only sprite atlas validation. Requires Pillow; never modifies images."""
from pathlib import Path
from PIL import Image

for path in sorted((Path(__file__).resolve().parents[1] / 'assets').glob('*.png')):
    with Image.open(path) as image:
        assert image.mode == 'RGBA', f'{path.name}: needs transparency'
        alpha = image.getchannel('A')
        assert alpha.getextrema()[0] == 0 and alpha.getextrema()[1] >= 250, f'{path.name}: missing transparent background'
        width, height = image.size
        cols, rows = {'gear':(6,6),'hero':(4,2),'guards':(4,2),'relics':(4,3),'frost':(4,6),'spider':(4,6),'demon':(4,6)}.get(path.stem,(4,5))
        cells = []
        for row in range(rows):
            for col in range(cols):
                cell = alpha.crop((round(col*width/cols), round(row*height/rows), round((col+1)*width/cols), round((row+1)*height/rows)))
                assert cell.getbbox(), f'{path.name}: empty frame {row}/{col}'
                cells.append(cell.getbbox())
        if path.stem in ['gear','hero','guards','relics']:
            assert alpha.histogram()[0] > width*height*.25, f'{path.name}: excessive background'
            print(f'{path.name}: {width}x{height}, RGBA, {cols*rows} nonempty cells')
            continue
        xcuts=[0]+[min(range(round(width*c/4)-25,round(width*c/4)+26),key=lambda x:(sum(v>128 for v in alpha.crop((x,0,x+1,height)).tobytes()),abs(x-width*c/4))) for c in range(1,4)]+[width]
        ycuts=[]
        for col in range(4):
            cuts=[0]
            for row in range(1,rows):
                cut=min(range(round(height*row/rows)-40,round(height*row/rows)+41),key=lambda y:(sum(v>128 for v in alpha.crop((xcuts[col],y,xcuts[col+1],y+1)).tobytes()),abs(y-height*row/rows)))
                cuts.append(cut)
            ycuts.append(cuts+[height])
        print(f'{path.name}: {width}x{height}, RGBA, {cols*rows} nonempty frames; xcuts={xcuts}; ycuts={ycuts}')
