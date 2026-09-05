# Petdex exporter

Turns any Menagerie animal into a [Petdex](https://petdex.dev) pet package:
a `pet.json` and an 8x9 spritesheet of 192x208 frames, one row per state.

```sh
node tools/petdex/build-pet.mjs index.html dragon ./out
```

The sprite grids, palettes, poses and moves are read straight out of
`index.html` at build time, so a pet is pixel-identical to the animal in the
app rather than a redrawn approximation. There are no dependencies; `zlib`
writes the PNG.

## What maps to what

Petdex asks for nine state rows. Seven already existed in the animator:

| Petdex row | frames | comes from |
|---|---|---|
| `idle` | 6 | the breathing loop |
| `running-right` | 8 | a run cycle written for the exporter |
| `running-left` | 8 | the same, leaning the other way |
| `waving` | 4 | the species signature move |
| `jumping` | 5 | five hand-authored poses |
| `failed` | 8 | the fight pose |
| `waiting` | 6 | asleep, with the floating z's |
| `running` | 6 | the run cycle, upright and in place |
| `review` | 6 | hunched over the laptop, typing |

The laptop prop is on for `idle`, `waiting` and `review`, and off for the
states where holding one would look absurd.

## Fitting the frame

Each species moves a different distance, so the exporter renders the sheet at
every scale from 12 down to 5 and keeps the largest one where no frame clips
the character. Decorative glyphs are measured separately and nudged back
inside the frame instead of being sliced, so a star or a speed line never
gets cut in half. The dragon fits at scale 9, a 144px character in a 192x208
frame; a species with a wider move lands lower.
