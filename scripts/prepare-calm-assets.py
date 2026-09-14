import shutil
"""Slice transparent props from a single sprite sheet and export optimized game assets."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
destination = root / "public/games/calm-match"
destination.mkdir(parents=True, exist_ok=True)
source_dir = root / "scripts/source-assets"

# 1. Process props from a single transparent sheet
props_sheet = Image.open(source_dir / "props-sheet.png").convert("RGBA")
w, h = props_sheet.size
split_x = (769 + 962) // 2

# Coffee
coffee_crop = props_sheet.crop((0, 0, split_x, h))
coffee_bbox = coffee_crop.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox()
coffee_item = coffee_crop.crop(coffee_bbox)
coffee_item.thumbnail((144, 144), Image.Resampling.LANCZOS)
coffee_sprite = Image.new("RGBA", (160, 160), (0, 0, 0, 0))
coffee_sprite.alpha_composite(
    coffee_item, ((160 - coffee_item.width) // 2, (160 - coffee_item.height) // 2)
)
coffee_out = destination / "coffee.webp"
coffee_sprite.save(coffee_out, "WEBP", quality=100, method=6)
print(f"{coffee_out.relative_to(root)}: 160 × 160, {coffee_out.stat().st_size} bytes")

# Plaster
plaster_crop = props_sheet.crop((split_x, 0, w, h))
plaster_bbox = plaster_crop.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox()
plaster_item = plaster_crop.crop(plaster_bbox)
plaster_item.thumbnail((144, 144), Image.Resampling.LANCZOS)
plaster_sprite = Image.new("RGBA", (160, 160), (0, 0, 0, 0))
plaster_sprite.alpha_composite(
    plaster_item, ((160 - plaster_item.width) // 2, (160 - plaster_item.height) // 2)
)
plaster_out = destination / "plaster.webp"
plaster_sprite.save(plaster_out, "WEBP", quality=100, method=6)
print(f"{plaster_out.relative_to(root)}: 160 × 160, {plaster_out.stat().st_size} bytes")

# Badge (Worker ID card)
badge_raw = Image.open(source_dir / "badge-raw.png").convert("RGBA")
badge_bbox = badge_raw.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox()
badge_item = badge_raw.crop(badge_bbox)
badge_item.thumbnail((144, 144), Image.Resampling.LANCZOS)
badge_sprite = Image.new("RGBA", (160, 160), (0, 0, 0, 0))
badge_sprite.alpha_composite(
    badge_item, ((160 - badge_item.width) // 2, (160 - badge_item.height) // 2)
)
badge_out = destination / "badge.webp"
badge_sprite.save(badge_out, "WEBP", quality=100, method=6)
print(f"{badge_out.relative_to(root)}: 160 × 160, {badge_out.stat().st_size} bytes")

# 2. Process background images (separate desktop and mobile)
bg_d_raw = Image.open(source_dir / "background-desktop-raw.png").convert("RGB")
bg_d_out = destination / "background-desktop.webp"
bg_d_raw.save(bg_d_out, "WEBP", quality=100, method=6)
print(f"{bg_d_out.relative_to(root)}: {bg_d_raw.size}, {bg_d_out.stat().st_size} bytes")

# Keep background.webp for compatibility
shutil.copyfile(bg_d_out, destination / "background.webp")

bg_m_raw = Image.open(source_dir / "background-mobile-raw.png").convert("RGB")
bg_m_out = destination / "background-mobile.webp"
bg_m_raw.save(bg_m_out, "WEBP", quality=100, method=6)
print(f"{bg_m_out.relative_to(root)}: {bg_m_raw.size}, {bg_m_out.stat().st_size} bytes")

# 3. Process UI button icons from a single sheet
btn_sheet = Image.open(source_dir / "buttons-sheet.png").convert("RGBA")
bw, bh = btn_sheet.size
bsplit1 = (672 + 816) // 2
bsplit2 = (1355 + 1548) // 2

btn_items = [
    ("btn-back", btn_sheet.crop((0, 0, bsplit1, bh))),
    ("btn-menu", btn_sheet.crop((bsplit1, 0, bsplit2, bh))),
    ("btn-hint", btn_sheet.crop((bsplit2, 0, bw, bh)))
]

for name, item in btn_items:
    bbox = item.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox()
    cropped = item.crop(bbox)
    cropped.thumbnail((108, 108), Image.Resampling.LANCZOS)
    sprite = Image.new("RGBA", (120, 120), (0, 0, 0, 0))
    sprite.alpha_composite(cropped, ((120 - cropped.width) // 2, (120 - cropped.height) // 2))
    out_path = destination / f"{name}.webp"
    sprite.save(out_path, "WEBP", quality=100, method=6)
    print(f"{out_path.relative_to(root)}: 120 × 120, {out_path.stat().st_size} bytes")

# 4. Process header title logo & countdown clock badge
header_sheet = Image.open(source_dir / "header-assets.png").convert("RGBA")
hw, hh = header_sheet.size
hsplit = (1285 + 1325) // 2

# Title logo
logo_crop = header_sheet.crop((0, 0, hsplit, hh))
logo_bbox = logo_crop.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox()
logo_item = logo_crop.crop(logo_bbox)
logo_w = 320
logo_h = int(logo_item.height * (logo_w / logo_item.width))
logo_resized = logo_item.resize((logo_w, logo_h), Image.Resampling.LANCZOS)
logo_out = destination / "logo.webp"
logo_resized.save(logo_out, "WEBP", quality=100, method=6)
print(f"{logo_out.relative_to(root)}: {logo_resized.size}, {logo_out.stat().st_size} bytes")

# Clock badge
clock_crop = header_sheet.crop((hsplit, 0, hw, hh))
clock_bbox = clock_crop.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox()
clock_item = clock_crop.crop(clock_bbox)
clock_item.thumbnail((108, 108), Image.Resampling.LANCZOS)
clock_sprite = Image.new("RGBA", (120, 120), (0, 0, 0, 0))
clock_sprite.alpha_composite(clock_item, ((120 - clock_item.width) // 2, (120 - clock_item.height) // 2))
clock_out = destination / "clock.webp"
clock_sprite.save(clock_out, "WEBP", quality=100, method=6)
print(f"{clock_out.relative_to(root)}: 120 × 120, {clock_out.stat().st_size} bytes")

# 5. Process sound toggle and restart button icons
tools_sheet = Image.open(source_dir / "tools-sheet.png").convert("RGBA")
tw, th = tools_sheet.size
tsplit1 = (653 + 791) // 2
tsplit2 = (1281 + 1492) // 2

tool_btn_items = [
    ("btn-sound-on", tools_sheet.crop((0, 0, tsplit1, th))),
    ("btn-sound-off", tools_sheet.crop((tsplit1, 0, tsplit2, th))),
    ("btn-restart", tools_sheet.crop((tsplit2, 0, tw, th)))
]

for name, item in tool_btn_items:
    bbox = item.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox()
    cropped = item.crop(bbox)
    cropped.thumbnail((108, 108), Image.Resampling.LANCZOS)
    sprite = Image.new("RGBA", (120, 120), (0, 0, 0, 0))
    sprite.alpha_composite(cropped, ((120 - cropped.width) // 2, (120 - cropped.height) // 2))
    out_path = destination / f"{name}.webp"
    sprite.save(out_path, "WEBP", quality=100, method=6)
    print(f"{out_path.relative_to(root)}: 120 × 120, {out_path.stat().st_size} bytes")
