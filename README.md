# Menagerie

Write a chat transcript and cast it with pixel animals. A tiger who shows up on
skates with her laptop still open. A dinosaur in headphones. Whoever you want in
the room.

### ▶ Use it: **https://devkancheti4-design.github.io/menagerie/**

Single HTML file — [`index.html`](index.html). No build step, no dependencies, no
tracking, no account. Download it and double-click it and it works, online or off.

## What it does

- **Cast the room.** Ten characters — Clawd, dinosaur, tiger, human, cat, frog,
  robot, owl, bunny, bear — each with a name, a colour dial that walks their whole
  palette around the wheel, and props: laptop, skates, headphones, sunglasses,
  party hat, coffee, scarf. Combine them freely. The tiger on skates holding a
  laptop is one click away, because that was the point.
- **Type the transcript.** Pick who is speaking, type, press Enter. Click any
  bubble to rewrite it. Click a speaker's avatar to hand that line to somebody
  else. Move lines up and down, or flip one into a **stage direction** — narration
  with no speaker, for when the ticket does not look back.
- **Anyone can sit on the right.** Mark a character as speaking from the right and
  their lines move over, the way your own messages do.
- **Take it with you.** *Copy link* puts the entire transcript inside the URL —
  nothing is stored on a server, so the link is the document. *Export PNG* draws
  the whole thing to an image in whichever theme you are using. There is also
  plain text and JSON in the ••• menu.

## How the characters are drawn

Nobody's avatar is an image file. Every character is a 16×16 grid of letters in
[`index.html`](index.html), one letter per pixel:

```
"..OOO......OOO..",
".OBBBOOOOOOBBBO.",
"..OOBBBBBBBBOO..",
"..OABBBBBBBBAO..",
"..OBEEBBBBEEBO..",
```

`B` is the body, `S` the torso, `L` a lighter belly, `A` an accent — stripes, hair
— `E` an eye, `M` a mouth or beak, `O` the outline, `.` nothing. The letters are
resolved against a palette held in HSL, which is what makes one slider able to
turn a brown bear teal without touching the outlines or the eyes.

Props live on the same grid and stack back-to-front in a fixed order, so a scarf
goes under a laptop and skates always end up over the feet. Everything is painted
with `fillRect` at an integer scale, so it stays crisp at any size, including
inside the exported PNG.

### Adding your own

Add an entry to `SPECIES` and it appears in the picker — nothing else needs
changing. Sixteen rows, sixteen characters each, plus a palette:

```js
axolotl: { label:"Axolotl", px:[ /* 16 rows of 16 */ ],
           pal:{B:[340,60,80], S:[340,55,72], L:[350,70,92],
                A:[340,70,70], M:[350,50,60]} },
```

Palette entries are `[hue, saturation%, lightness%]`. An optional `hue:["S","A"]`
says which slots the colour dial should move — the human uses it so the dial
changes their shirt and hair rather than their skin. Props go in `PROPS` the same
way, using the fixed prop palette, and get a slot in `PROP_ORDER` to say what they
sit in front of.

Pull requests with new residents are welcome.

## Details

- Light and dark themes, both defined at token level; the ••• menu cycles
  system → light → dark.
- Everything persists in `localStorage`. Nothing is sent anywhere — the link and
  the PNG are made in your browser.
- Pasted-in transcripts and shared links run through a sanitiser: unknown species
  fall back, stray fields are dropped, text is set with `textContent` rather than
  parsed as markup.
- Works down to a phone, where the cast list becomes a drawer.
- Respects `prefers-reduced-motion`.

## Deploy

Settings → Pages → Deploy from a branch → `main` / root. That is the whole
process; there is nothing to build.

## Licence

Do what you like with it.
