"""Measure authored equipment regions without modifying their source PNGs."""
from pathlib import Path
from PIL import Image
import json

root = Path(__file__).resolve().parents[1]
result = {}
for name in ['base', 'plate', 'parts', 'held', 'robe-top']:
    image = Image.open(root/'assets'/'paperdoll'/f'{name}.png')
    assert image.mode == 'RGBA', name
    minimum, maximum = image.getchannel('A').getextrema()
    assert minimum == 0 and maximum >= 250, name
    width, height = image.size
    alpha = image.getchannel('A').point(lambda value: 255 if value >= 200 else 0)
    if name == 'parts':
        columns, cuts = 4, [0, 270, 588, 840, height]
    elif name == 'held':
        columns, cuts = 4, [0, round(height*.2), round(height*.4), round(height*.57), round(height*.75), height]
    else:
        columns, cuts = 1, [0, height]
    pixels = alpha.tobytes()
    owners = [-1]*(width*height)
    for seed, value in enumerate(pixels):
        if not value or owners[seed] != -1:
            continue
        component = [seed]
        owners[seed] = -2
        for index in component:
            x = index % width
            for neighbor in (index-1, index+1, index-width, index+width):
                if 0 <= neighbor < width*height and abs(neighbor % width-x) <= 1 and pixels[neighbor] and owners[neighbor] == -1:
                    owners[neighbor] = -2
                    component.append(neighbor)
        cx = sum(index % width for index in component)/len(component)
        cy = sum(index // width for index in component)/len(component)
        column = min(columns-1, int(cx/width*columns))
        row = min(len(cuts)-2, next((r for r in range(len(cuts)-1) if cuts[r] <= cy < cuts[r+1]), len(cuts)-2))
        for index in component:
            owners[index] = row*columns+column
    frames = []
    for frame in range(columns*(len(cuts)-1)):
        offsets = [index for index, owner in enumerate(owners) if owner == frame]
        assert len(offsets) > 200, (name, frame)
        x, y = min(index % width for index in offsets), min(index // width for index in offsets)
        right, bottom = max(index % width for index in offsets)+1, max(index // width for index in offsets)+1
        runs = []
        for py in range(y, bottom):
            px = x
            while px < right:
                if owners[py*width+px] != frame:
                    px += 1
                    continue
                start = px
                while px < right and owners[py*width+px] == frame:
                    px += 1
                runs.append([start-x, py-y, px-start])
        frames.append(dict(crop=[x,y,right-x,bottom-y],runs=runs))
    assert sum(run[2] for frame in frames for run in frame['runs']) == sum(bool(value) for value in pixels)
    result['doll-'+name] = dict(width=width, height=height, frames=frames)
    print(name, [frame['crop'] for frame in frames])
(root/'paperdoll-atlas.mjs').write_text('export const PAPERDOLL_ATLAS = '+json.dumps(result,separators=(',', ':'))+';\n', encoding='utf-8')
