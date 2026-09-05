# Menagerie

A chat interface for local and hosted language models where a pixel animal does
the typing. It sleeps when you leave it alone, hunches over its laptop while the
model streams, dances when a reply lands, and squares up when the request fails.

### ▶ Open it: **https://devkancheti4-design.github.io/shiv1/**

Nothing to install. It is a web page. Open it and start typing.

Two single HTML files, no build step, no dependencies, no tracking, no account:

- [`index.html`](index.html) is the chat UI.
- [`transcript.html`](transcript.html) is a transcript maker: write a scene and
  cast it with the same animals.

Download either one, double-click it, and it works.

## How to use it

**1. Open it.** Click the link above, or download `index.html` and double-click
it. There is nothing to install and no account.

**2. Point it at a model.** On first run it knocks on every local port it knows
about at once and connects to whatever answers. If nothing does, you get a
**Connect a model** card with one button per provider:

- **On this machine**: Ollama, LM Studio, llama.cpp, vLLM, Jan.
- **Hosted, with your key**: Anthropic, OpenAI, OpenRouter, Groq, Together.
- **Or point it anywhere**: paste any base URL. It works out for itself whether
  the thing on the other end speaks Ollama or OpenAI, and whether the models
  live at the URL you gave or one level down at `/v1`.

There is also a **Scan this machine** button if you started something after the
page loaded. The same buttons live in Settings.

Hit **List** to pull the available models, or type a model name yourself. **Test
the connection** tells you whether it answered.

**3. Ask for something.** Enter sends, Shift+Enter makes a new line. The reply
renders in the chat and streams raw on the laptop screen at the same time.
**Stop** ends a reply early and keeps what already arrived. **New** clears the
conversation.

**4. Play with the den.** Click the animal for its signature move. Each has its
own sound. Pick a different one from the strip, hand it a laptop or skates or a
party hat, and leave it alone for twenty seconds to watch it fall asleep. **♪**
in the header mutes everything; **◐** cycles light, dark, and system themes.

On a narrow screen the den is behind the **Den** button.


## Two screens for every reply

The point of the layout is that the answer arrives twice.

- **The chat**, on the left, looks like any assistant: bubbles, rendered
  markdown, code blocks with a copy button.
- **The laptop screen**, in the den, shows the same stream *raw* as it arrives:
  the words, the fences, the code, the token count, how long it took. On models
  that reason, the thinking lands here in dim italics and never pollutes the
  chat. It is genuinely the same byte stream, one rendered and one not.

Underneath the screen sits whoever you picked, typing while it happens.

## The residents

Seventeen of them: **Clawd, dinosaur, tiger, human, cat, frog, robot, owl,
bunny, bear, shark, penguin, octopus, fox, dragon, crab, sloth.** Hand each one a
laptop, skates, headphones, sunglasses, a party hat, coffee, or a scarf.

**Click an animal and it does its signature move.** The shark lunges and chomps.
The penguin belly-slides. The dragon rears back and breathes fire. The crab
scuttles sideways in a cloud of bubbles, the octopus wiggles all eight, the fox
leaves speed lines, and the sloth takes a very long time to stretch.

Every animal has its own voice, synthesised on the spot with the Web Audio API.
No audio files to download. The dinosaur shouts, the tiger and the bear growl
underneath it, the cat complains on the way up and the way down, the owl asks
twice and does not wait for an answer, the fox yips, the penguin brays, the
frog gets two notes and the crab gets seven clicks. A roar is a pitch arc with
a throat resonance over it and a wobble in the gain, which is the difference
between a growl and a beep. **♪** in the header mutes the lot, and it sticks.

Four moods run on their own:

| | |
|---|---|
| **asleep** | nothing asked for 22 seconds, floating `z`s, screen dimmed |
| **working** | a reply is streaming, head down, typing, screen alive |
| **nailed it** | the reply landed, a hop and a shower of stars |
| **that went badly** | the request failed, braced, leaning in, red `!` |

## Connecting a model

Open **Settings**. On first run it looks for Ollama, then LM Studio, and falls
back to a scripted demo so the page still does something.

**Ollama** at `http://localhost:11434`, the default. Every model you have pulled
shows up in the picker.

> Ollama only accepts requests from **localhost origins**. Opening this page
> from `file://` or from the GitHub Pages link above will fail, and the error
> message in the app says so. Either serve the file locally:
>
> ```bash
> python3 -m http.server 8765   # then open http://localhost:8765
> ```
>
> or let any origin in: `OLLAMA_ORIGINS='*' ollama serve`.

**Anything OpenAI-compatible**: LM Studio on `http://localhost:1234/v1`,
llama.cpp, vLLM, LocalAI, OpenRouter, OpenAI itself. Key optional.

**The Anthropic API**: paste a key and pick a model. Requests stream from the
browser with `anthropic-dangerous-direct-browser-access`, run adaptive thinking
with summaries (that is what fills the laptop screen), and opt into server-side
fallbacks so a declined request is retried rather than coming back empty.

### About API keys

A key you paste is kept in this browser's `localStorage` and sent straight from
your browser to the provider. There is no server in the middle, because there is
no server at all. That also means a key pasted into a copy of this page that
other people can open is a key other people can use. Use one you can revoke, and
there is a **Forget** button next to the field.

---

*Everything above is all you need to use it. The rest is for anyone who
wants to take it apart.*

## How the animals are drawn

Nobody is an image file. Every character is a 16×16 grid of letters, one letter
per pixel, sitting in plain sight in the HTML:

```
"..OOO......OOO..",
".OBBBOOOOOOBBBO.",
"..OOBBBBBBBBOO..",
"..OABBBBBBBBAO..",
"..OBEEBBBBEEBO..",
```

`B` is the body, `S` the torso, `L` a lighter belly, `A` an accent, `E` an eye,
`M` a mouth or beak, `O` the outline, `.` nothing. Those resolve against a
palette held in HSL, which is what lets one dial turn a brown bear teal without
touching its outlines or its eyes.

Animation never touches the artwork. The grid splits at row 10, head above and
body below, and each half is offset independently, with a shear that leans the
top and tapers to nothing at the feet, so every pose still lands on whole pixels.
A mood is a function from seconds-in-state to that handful of offsets plus some
glyphs to scatter, which means a dropped frame can never leave anyone stuck
halfway through a dance.

### Adding your own

Add an entry to `SPECIES` and it appears in the picker. Sixteen rows of sixteen
characters, a palette, and, in the chat UI, which move it does when clicked:

```js
axolotl: { label:"Axolotl", move:"wiggle", fx:"bubble", cry:"Frills",
           px:[ /* 16 rows of 16 */ ],
           pal:{B:[340,60,80], S:[340,55,72], L:[350,70,92],
                A:[340,70,70], M:[350,50,60]} },
```

Palette entries are `[hue, saturation%, lightness%]`. An optional
`hue:["S","A"]` says which slots the colour dial moves. The human uses it so the
dial changes their shirt and hair rather than their skin. `move` names one of the
sixteen choreographies in `MOVES`, `fx` one of the glyphs, `cry` the word that
pops up. Props go in `PROPS` the same way and take a slot in `PROP_ORDER` to say
what they sit in front of.

Both files carry their own copy of the roster on purpose, because each has to work
alone when you download it.

## The pets, as an API

Every animal is also exported as a [Petdex](https://petdex.dev) pet and
committed under [`pets/`](pets/). GitHub Pages serves that directory with
`access-control-allow-origin: *`, so it works as a read-only API from any
origin, with no server and no key.

```
https://devkancheti4-design.github.io/shiv1/pets/index.json
https://devkancheti4-design.github.io/shiv1/pets/<id>/pet.json
https://devkancheti4-design.github.io/shiv1/pets/<id>/spritesheet.png
https://devkancheti4-design.github.io/shiv1/pets/<id>/<id>.zip
```

`index.json` carries the roster and, once, the sprite format they all share:
an 8 by 9 grid of 192 by 208 frames, one row per state, with the frame count
and duration for each. Paths inside it are relative to the index itself, so
the same file works from whichever host is serving it.

```js
const base = "https://devkancheti4-design.github.io/shiv1/pets/";
const index = await fetch(base + "index.json").then(r => r.json());

for (const pet of index.pets){
  console.log(pet.id, pet.name, base + pet.spritesheet);
}
// barley Barley .../pets/barley/spritesheet.png
// biscuit Biscuit .../pets/biscuit/spritesheet.png
// ...
```

Seventeen pets: Ember, Chomp, Waddle, Squish, Zoom, Pinch, Doze, Pip, Rex,
Stripe, Dev, Mochi, Pesto, Bolt, Otto, Biscuit and Barley. Each keeps its
species' signature move as the `waving` state, so they are not recolours of
one animal. Everything under `pets/` is generated, and one command rebuilds
it:

```sh
node tools/petdex/build-pet.mjs index.html all
```

See [`tools/petdex/`](tools/petdex/) for how the sheets are rendered.

## Details

- Light and dark themes, both defined at token level.
- Conversations, settings, and your chosen animal persist in `localStorage`.
  Nothing is sent anywhere except to the model endpoint you pick.
- Streaming is parsed by hand for all three wire formats: Ollama's NDJSON, SSE
  from OpenAI-compatible servers, and Anthropic's typed events. **Stop**
  aborts mid-flight and keeps what already arrived.
- Connecting is a guess-and-check, not a form to fill in: the page probes the
  known local ports in parallel, and a pasted URL is sniffed for which protocol
  it speaks before anything is saved.
- Failures explain themselves. A refused connection to Ollama tells you about
  origins and gives you the command; a 401 says the key was rejected.
- The markdown renderer escapes first and builds nodes second, so a model that
  emits HTML gets it shown, not run. Code fences render as code while they are
  still being streamed and before the closing fence arrives.
- Sound is a handful of oscillators and filtered noise per move, built lazily on
  the first click, because browsers keep audio suspended until a page has been touched,
  and clicking is how a move starts anyway.
- Works down to a phone, where the den becomes a drawer.
- Respects `prefers-reduced-motion`: moves resolve to a single held pose.

## Deploy

Settings → Pages → Deploy from a branch → `main` / root. There is nothing to
build. Remember that a local model will not be reachable from the Pages copy
unless you widen its allowed origins.

## Licence

[Apache License 2.0](LICENSE). Use it, change it, ship it, sell it. Keep the
notice and the licence with it, and there is an explicit patent grant.

The copyright line in `LICENSE` reads `2026 devkancheti4-design`; change it to
your legal name or company if you would rather it say that.
