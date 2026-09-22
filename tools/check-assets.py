"""Read-only sprite atlas validation. Requires Pillow; never modifies images."""
from pathlib import Path
from PIL import Image

for path in sorted((Path(__file__).resolve().parents[1] / 'assets').glob('*.png')):
    with Image.open(path) as image:
        assert image.mode == 'RGBA', f'{path.name}: needs transparency'
        alpha = image.getchannel('A')
        assert alpha.getextrema() == (0, 255), f'{path.name}: missing transparent background'
        width, height = image.size
        cells = []
        for row in range(5):
            for col in range(4):
                cell = alpha.crop((round(col*width/4), round(row*height/5), round((col+1)*width/4), round((row+1)*height/5)))
                assert cell.getbbox(), f'{path.name}: empty frame {row}/{col}'
                cells.append(cell.getbbox())
        xcuts=[0]+[min(range(round(width*c/4)-25,round(width*c/4)+26),key=lambda x:(sum(v>128 for v in alpha.crop((x,0,x+1,height)).tobytes()),abs(x-width*c/4))) for c in range(1,4)]+[width]
        ycuts=[]
        for col in range(4):
            cuts=[0]
            for row in range(1,5):
                cut=min(range(round(height*row/5)-40,round(height*row/5)+41),key=lambda y:(sum(v>128 for v in alpha.crop((xcuts[col],y,xcuts[col+1],y+1)).tobytes()),abs(y-height*row/5)))
                cuts.append(cut)
            ycuts.append(cuts+[height])
        print(f'{path.name}: {width}x{height}, RGBA, 20 nonempty frames; xcuts={xcuts}; ycuts={ycuts}')
