"""Separate the city pencil marks from the embedded scan's beige paper."""

import base64
import io
import re
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter


root = Path(__file__).resolve().parents[1]
source = (root / 'portal.html').read_text()
match = re.search(r'class="entry-city-image"[^>]*src="data:image/png;base64,([^"]+)', source)
if not match:
    raise SystemExit('The original entry illustration was not found')
image = Image.open(io.BytesIO(base64.b64decode(match.group(1)))).convert('RGB')
rgb = np.asarray(image, dtype=np.float32)
# Remove the paper and its soft lighting by retaining only small, darker
# pencil details. A broad maximum would also keep the scan's blurry shadows.
paper = gaussian_filter(rgb, sigma=(8, 8, 0))
darkness = np.max(paper - rgb, axis=2)
alpha = np.clip((darkness - 1.5) / 60, 0, .72)
# Keep the hand-drawn line weight and warm sepia hue; remove the scan's paper.
ink = np.empty((*alpha.shape, 4), dtype=np.uint8)
ink[:, :, :3] = (105, 75, 53)
ink[:, :, 3] = np.rint(alpha * 255).astype(np.uint8)
destination = root / 'assets' / 'entry-city-ink.png'
Image.fromarray(ink, 'RGBA').save(destination, optimize=True)
print(f'{destination.relative_to(root)}: {destination.stat().st_size:,} bytes')
