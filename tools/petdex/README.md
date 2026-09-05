# Petdex exporter

Turns any Menagerie animal into a [Petdex](https://petdex.dev) pet package:
a `pet.json` and an 8x9 spritesheet of 192x208 frames, one row per state.

```sh
node tools/petdex/build-pet.mjs index.html all             # every animal
node tools/petdex/build-pet.mjs index.html dragon          # just one
node tools/petdex/build-pet.mjs index.html all ./somewhere # elsewhere
```

Output goes to [`pets/`](../../pets) at the repo root by default: for each
animal a `pet.json`, a `spritesheet.png`, and a `<id>.zip` ready to hand to
`npx petdex submit` or drop at petdex.dev/submit. Building the whole roster
also refreshes `pets/index.json`, which is what makes that directory readable
as an API. Names, descriptions and tags live in
[`pets.json`](pets.json), keyed by species. Open [`contact.html`](contact.html) over a local server to flip through the
whole roster one state at a time (`?row=0` through `?row=8`).

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
frame. The fox and the crab travel further in their signature moves and land
at scale 7.

## No dependencies, including the zip

`zlib` writes the PNG, and the zip is assembled by hand from the same deflate
and CRC-32 the PNG already needs. Nothing is installed and nothing is shelled
out to, so the exporter runs the same on any machine with Node.
