# nyu-journal

An interactive NYU campus map built with React and TypeScript, using the vector
shapes from `nyu-downloadable-campus-map.pdf`.

```sh
npm install
npm run dev
```

Drag to pan, and scroll, pinch, or double-click to zoom. Arrow keys and `+`/`-`
also work, and `0` returns to Washington Square Park.

Hover over an NYU building to see its name.

`src/data/campusMap.ts` is generated from the PDF by
`scripts/extract_campus_map.py` (requires `pip install pymupdf`).
