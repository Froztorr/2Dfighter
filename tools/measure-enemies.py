"""Read-only alpha segmentation. Emit source-pixel runs; never repaint a PNG."""
from pathlib import Path
from collections import deque
from statistics import median
from PIL import Image
import json

root = Path(__file__).resolve().parents[1]
result = {}
for name in ['brute', 'lizard', 'wraith', 'knight', 'frost', 'spider', 'demon']:
    image = Image.open(root / 'assets' / f'{name}-v2.png')
    width, height = image.size
    alpha = image.getchannel('A').tobytes()
    owners = [-1] * (width * height)
    queue = deque()
    # Geodesic ownership separates touching tips without straight cuts through limbs.
    for row in range(5):
        for column in range(8):
            cx, cy = (column + .5) * width / 8, (row + (.9 if row == 0 and column == 7 else .72 if row == 0 and column == 6 else .62)) * height / 5
            candidates = ((x, y) for y in range(round(cy-height/20), round(cy+height/20))
                          for x in range(round(cx-width/32), round(cx+width/32))
                          if 0 <= x < width and 0 <= y < height and alpha[y*width+x] >= 100)
            x, y = min(candidates, key=lambda point: (point[0]-cx)**2+(point[1]-cy)**2)
            index = y*width+x
            owners[index] = row*8+column
            queue.append(index)
    while queue:
        index = queue.popleft()
        x = index % width
        for neighbor in (index-1, index+1, index-width, index+width):
            if 0 <= neighbor < width*height and abs(neighbor % width-x) <= 1 and owners[neighbor] < 0 and alpha[neighbor] >= 100:
                owners[neighbor] = owners[index]
                queue.append(neighbor)
    # Detached blades, fingers and magic motes still belong to their authored cell.
    # Keep whole components instead of dropping them or chopping them at grid lines.
    for seed, value in enumerate(alpha):
        if value < 100 or owners[seed] >= 0:
            continue
        component = [seed]
        owners[seed] = -2
        for index in component:
            x = index % width
            for neighbor in (index-1, index+1, index-width, index+width):
                if 0 <= neighbor < width*height and abs(neighbor % width-x) <= 1 and owners[neighbor] == -1 and alpha[neighbor] >= 100:
                    owners[neighbor] = -2
                    component.append(neighbor)
        cx = sum(offset % width for offset in component)/len(component)
        cy = sum(offset // width for offset in component)/len(component)
        column = max(0, min(7, int(cx/width*8)))
        row = max(0, min(4, int(cy/height*5)))
        for offset in component:
            owners[offset] = row*8+column
    frames = []
    for index in range(40):
        pixels = [offset for offset, owner in enumerate(owners) if owner == index]
        assert len(pixels) > 200, (name, index, 'empty figure')
        x0, x1 = min(offset % width for offset in pixels), max(offset % width for offset in pixels)+1
        y0, y1 = min(offset // width for offset in pixels), max(offset // width for offset in pixels)+1
        runs = []
        for y in range(y0, y1):
            x = x0
            while x < x1:
                if owners[y*width+x] != index:
                    x += 1
                    continue
                start = x
                while x < x1 and owners[y*width+x] == index:
                    x += 1
                runs.append([start-x0, y-y0, x-start])
        center = (index % 8+.5)*width/8
        foot = [offset for offset in pixels if abs(offset % width-center) < width/8*.23]
        ground = max(offset // width for offset in foot)+1 if foot else y1
        anchor = median(offset % width for offset in pixels if offset // width > ground-(y1-y0)*.2)
        frames.append(dict(row=index//8, column=index%8, sx=x0, sy=y0, sw=x1-x0, sh=y1-y0, ground=ground, anchorX=round(anchor), runs=runs))
    body_height = median(frame['ground']-frame['sy'] for frame in frames[:3])
    assert sum(run[2] for frame in frames for run in frame['runs']) == sum(value >= 100 for value in alpha)
    result[name] = dict(width=width, height=height, columns=8, bodyHeight=body_height, frames=frames)
    print(f'{name}: {len(frames)} isolated frames, body height {body_height}')
(root/'enemy-atlas.mjs').write_text('export const ENEMY_ATLAS = '+json.dumps(result,separators=(',', ':'))+';\n', encoding='utf-8')
