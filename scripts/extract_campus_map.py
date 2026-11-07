"""Generate src/data/campusMap.ts from the vector paths in the campus map PDF.

Usage: python scripts/extract_campus_map.py   (requires: pip install pymupdf)

Page 3 of the PDF is the Manhattan map without the sidebar. Its drawings are
painted in this order: neighborhood blocks, parks, NYU buildings, streets, then
the frame, title, compass, and transit markers. Everything from the frame
onward is discarded.

Building names come from the index on page 4, joined through the number printed
on each building. Page 3 omits building 4, so that shape is taken from the map
on page 1, which is the same map at a smaller scale.
"""

import json
import re
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
PDF_PATH = ROOT / "nyu-downloadable-campus-map.pdf"
OUTPUT_PATH = ROOT / "src" / "data" / "campusMap.ts"
PAGE_INDEX = 2
SIDEBAR_MAP_PAGE_INDEX = 0
INDEX_PAGE_INDEX = 3

FRAME_COLOR = "#939598"
BUILDING_COLORS = {"#262261", "#262262"}
PARK_COLOR = "#9fbf81"
WHITE = "#ffffff"
# Parks are told apart by position: Washington Square Park is the southern one.
EXPECTED_BUILDINGS = 89
EXPECTED_PARKS = 2
# Drawn only on the page 1 map.
BUILDINGS_ONLY_ON_SIDEBAR_MAP = {4}
# On the map, but with no entry in the index.
NUMBERS_WITHOUT_NAMES = {45, 58}


def to_hex(color):
    if color is None:
        return None
    return "#%02x%02x%02x" % tuple(round(v * 255) for v in color)


def num(value):
    return f"{value:.2f}".rstrip("0").rstrip(".")


def path_data(drawing, origin, scale=1):
    ox, oy = origin
    parts = []
    current = None

    def sx(x):
        return num((x - ox) * scale)

    def sy(y):
        return num((y - oy) * scale)

    def pt(p):
        return f"{sx(p.x)} {sy(p.y)}"

    def move_if_needed(start):
        if current is None or abs(start.x - current.x) > 1e-3 or abs(start.y - current.y) > 1e-3:
            parts.append(f"M{pt(start)}")

    for item in drawing["items"]:
        kind = item[0]
        if kind == "l":
            move_if_needed(item[1])
            parts.append(f"L{pt(item[2])}")
            current = item[2]
        elif kind == "c":
            move_if_needed(item[1])
            parts.append(f"C{pt(item[2])} {pt(item[3])} {pt(item[4])}")
            current = item[4]
        elif kind == "re":
            r = item[1]
            parts.append(f"M{sx(r.x0)} {sy(r.y0)}H{sx(r.x1)}V{sy(r.y1)}H{sx(r.x0)}Z")
            current = None
        else:
            raise ValueError(f"Unsupported path segment: {kind}")
    if drawing.get("closePath"):
        parts.append("Z")
    return "".join(parts)


def inner_frame(frame):
    """The frame is an outer rectangle with a rectangular hole: the map area."""
    points = []
    for item in frame["items"]:
        if item[0] == "l":
            points += [item[1], item[2]]
    return pymupdf.Rect(
        min(p.x for p in points),
        min(p.y for p in points),
        max(p.x for p in points),
        max(p.y for p in points),
    )


def map_layers(page):
    """Returns the drawings beneath the frame, and the frame's inner rectangle."""
    drawings = page.get_drawings()
    frame_index = next(
        i for i, d in enumerate(drawings) if to_hex(d.get("fill")) == FRAME_COLOR
    )
    return drawings[:frame_index], inner_frame(drawings[frame_index])


def is_building(drawing):
    return to_hex(drawing.get("fill")) in BUILDING_COLORS


def building_number(drawing, page):
    """The number printed inside a building's shape, or None if it has none."""
    numbers = [
        int(word[4])
        for word in page.get_text("words")
        if re.fullmatch(r"\d{1,2}", word[4])
        and drawing["rect"].contains(
            pymupdf.Point((word[0] + word[2]) / 2, (word[1] + word[3]) / 2)
        )
    ]
    if len(numbers) > 1:
        raise ValueError(f"Several numbers in one building: {numbers}")
    return numbers[0] if numbers else None


def parse_index(page):
    """Returns {building number: [names]}. Entries marked "not on map" have no number.

    Names are in a medium weight and may wrap onto further lines. The grid
    reference, such as (B-2), comes at the end of the name and is in a book
    weight, as is the address line that follows. A wrapped acronym can follow
    the grid reference, as in "Global Center ... Life (B-3)" / "(GCASL)".
    """
    entries = []
    current = None
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            medium = "".join(
                s["text"] for s in line["spans"] if s["font"] == "Gotham-Medium"
            ).strip()
            other = "".join(
                s["text"] for s in line["spans"] if s["font"] != "Gotham-Medium"
            )
            if medium:
                # A few numbers are on a text line of their own, before the name.
                numbered = re.match(r"^(\d{1,2})(?:\s+(.*))?$", medium, re.DOTALL)
                if numbered:
                    current = {
                        "number": int(numbered.group(1)),
                        "name": (numbered.group(2) or "").strip(),
                        "complete": False,
                    }
                    entries.append(current)
                elif current and (not current["complete"] or medium.startswith("(")):
                    current["name"] = f"{current['name']} {medium}".strip()
                else:
                    current = {"number": None, "name": medium, "complete": False}
                    entries.append(current)
            if current and re.search(r"\([A-C]-\d\)|not on map", other):
                current["complete"] = True

    names_by_number = {}
    for entry in entries:
        if entry["number"] is not None:
            names_by_number.setdefault(entry["number"], []).append(entry["name"])
    return names_by_number


def main():
    document = pymupdf.open(PDF_PATH)
    page = document[PAGE_INDEX]
    layers, frame = map_layers(page)
    origin = (frame.x0, frame.y0)
    names_by_number = parse_index(document[INDEX_PAGE_INDEX])

    blocks, parks, buildings, roads = [], [], [], []
    for drawing in layers:
        fill = to_hex(drawing.get("fill"))
        stroke = to_hex(drawing.get("color"))
        d = path_data(drawing, origin)
        if is_building(drawing):
            buildings.append(
                {
                    "number": building_number(drawing, page),
                    "rect": drawing["rect"],
                    "d": d,
                }
            )
        elif fill == PARK_COLOR:
            parks.append((drawing["rect"], d))
        elif stroke == WHITE:
            roads.append({"d": d, "strokeWidth": drawing["width"]})
        elif fill == WHITE:
            roads.append({"d": d})
        elif fill is not None:
            blocks.append(d)
        else:
            raise ValueError(f"Unclassified drawing: {drawing}")

    if len(buildings) != EXPECTED_BUILDINGS or len(parks) != EXPECTED_PARKS:
        raise ValueError(f"Found {len(buildings)} buildings and {len(parks)} parks")

    # A shape without a number is a wing of the numbered shape that it touches.
    for building in buildings:
        if building["number"] is None:
            neighbor = next(
                b
                for b in buildings
                if b["number"] is not None and b["rect"].intersects(building["rect"])
            )
            building["number"] = neighbor["number"]

    sidebar_page = document[SIDEBAR_MAP_PAGE_INDEX]
    sidebar_layers, sidebar_frame = map_layers(sidebar_page)
    scale = frame.width / sidebar_frame.width
    for drawing in sidebar_layers:
        if not is_building(drawing):
            continue
        number = building_number(drawing, sidebar_page)
        if number in BUILDINGS_ONLY_ON_SIDEBAR_MAP:
            buildings.append(
                {
                    "number": number,
                    "d": path_data(drawing, (sidebar_frame.x0, sidebar_frame.y0), scale),
                }
            )

    numbers = {b["number"] for b in buildings}
    if not BUILDINGS_ONLY_ON_SIDEBAR_MAP <= numbers:
        raise ValueError("Missing a building expected on the page 1 map")
    unnamed = {n for n in numbers if n not in names_by_number}
    if unnamed != NUMBERS_WITHOUT_NAMES:
        raise ValueError(f"Buildings without index names: {sorted(unnamed)}")

    union_square, washington_square = sorted(parks, key=lambda park: park[0].y0)
    w = washington_square[0]
    data = {
        "width": round(frame.width, 2),
        "height": round(frame.height, 2),
        "washingtonSquarePark": {
            "x": round(w.x0 - frame.x0, 2),
            "y": round(w.y0 - frame.y0, 2),
            "width": round(w.width, 2),
            "height": round(w.height, 2),
        },
        "blocks": blocks,
        "parks": [union_square[1], washington_square[1]],
        "buildings": [
            {
                "id": f"building-{i}",
                "number": b["number"],
                "names": sorted(names_by_number.get(b["number"], []), key=str.casefold),
                "d": b["d"],
            }
            for i, b in enumerate(buildings, start=1)
        ],
        "roads": roads,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        "// Generated by scripts/extract_campus_map.py. Do not edit by hand.\n"
        'import type { CampusMapData } from "./types";\n\n'
        f"export const campusMap: CampusMapData = {json.dumps(data, indent=2, ensure_ascii=False)};\n",
        encoding="utf-8",
        newline="\n",
    )
    print(
        f"frame={frame} blocks={len(blocks)} parks={len(parks)} "
        f"buildings={len(data['buildings'])} roads={len(roads)}"
    )


if __name__ == "__main__":
    main()
