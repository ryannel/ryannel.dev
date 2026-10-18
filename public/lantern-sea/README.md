# The Lantern Sea — map explorer

A portable web delivery of the 12,276 × 8,184 (100,465,584-pixel) atlas from **world-atlas-complete-v1**. The map was assembled from 81 AI-painted production pieces. No new painting was generated for this viewer.

The owner selected the existing clean painting and its flattened labelled export for this explorer. `map.json` records the exact source filenames, SHA-256 checksums, dimensions, encoding quality, modes and tile counts. The input PNGs remain unchanged in the original project. No private setting documents, raw prompts, original production directories or GM metadata are included.

The tiles are lossy WebP delivery files at native resolution, quality 90, with 512-pixel interiors and one-pixel overlap. They cannot reconstruct the original lossless PNG pixels. Place names are part of the labelled tiles; the second pyramid contains the clean painting. The small `overview.jpg` is an unchanged copy of the existing selected public preview.

Source review status remains: **agent review complete; user review of the eastern expansion pending in the source release record**. Viewer checks do not establish new approval of the painting or its geographic accuracy.

Serve this folder over HTTP and open `index.html`. It needs no build, API key, custom font or internet service. Keep `index.html`, `viewer.css`, `viewer.js`, `map.json`, `tiles/`, `overview.jpg` and this README together. `?embed=1` removes the surrounding title and footer for an article embed. The hash remembers position, scale and place-name mode.

The source masters are intentionally omitted. They are approximately 289 MB and 287 MB. The browser requests the overview and visible detail tiles, never those PNGs.

[Read the article](https://ryannel.dev/projects/painting-a-100-megapixel-world/) · [Map-making experiment and build recipe](https://github.com/ryannel/experiments/tree/main/map_creation)

The artwork is demonstration material with rights reserved by the relevant holders; inclusion in this repo does not grant a broad reuse or commercial license. This notice does not assert rights that do not exist in AI-generated material.
