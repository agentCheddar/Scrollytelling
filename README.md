# Scrollytelling: poem close readings

A no-build, plain HTML/CSS/JS template for scrolling poem analyses. The poem stays
pinned on the left. Analysis paragraphs and images scroll past on the right. Each
paragraph can bold, highlight, shake, ripple (and more) parts of the poem while it's
on screen.

The example is Sylvia Plath's "Mirror". Its poem lines and analysis are placeholder
text for now.

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8417
```

On narrow screens the poem pins to the top half of the screen. It scrolls itself to
whichever lines the current paragraph is about, and the analysis cards scroll beneath it.

## Add the poem

Paste the poem into the `<script type="text/plain" class="poem-text">` block in
`index.html`. Put one line of the poem on each line, with a blank line between stanzas.
Leading indentation is kept. Lines are numbered automatically.

"Mirror" is still under copyright, so this repo doesn't include its text. Use the text
from your own licensed copy. The line numbers in the example steps already match the
real poem's 18 lines (two stanzas of nine). Only the quoted phrases need changing to
the poem's actual words.

## Write the analysis

Each step is a `<section class="step">`. Its `data-fx` attribute says what happens to
the poem while that step is active:

```html
<section class="step" data-fx="focus: 4-5; highlight: 4 'quis nostrud'">
  <p class="kicker">Lines 4–5</p>
  <p>Your analysis…</p>
</section>
```

**Syntax:** `effect [effect…]: target`, with rules separated by `;`.

| Target          | Means                                                     |
| --------------- | --------------------------------------------------------- |
| `3`             | line 3                                                    |
| `2-4`, `1, 5`   | a range or a list of lines                                |
| `s2`            | every line of stanza 2                                    |
| `all`           | the whole poem                                            |
| `3 'some words'` | just that phrase inside line 3                           |
| `'some words'`  | that phrase wherever it appears                           |

Phrases can be quoted with `'…'`, `"…"` or `“…”`. Matching ignores case and curly
vs. straight apostrophes. If a phrase includes an apostrophe, quote it with `“…”`. If
a phrase isn't found, the effect falls back to the whole line. A warning about it
shows up in the browser console.

An empty `data-fx=""` clears all effects, which suits an intro or outro step.

## Effects

| Effect      | What it does                                              |
| ----------- | --------------------------------------------------------- |
| `focus`     | dims everything except the target                         |
| `blur`      | blurs everything except the target's line                 |
| `bold`      | animates to bold                                          |
| `accent`    | shifts to the accent color                                |
| `highlight` | marker-pen sweep behind the text                          |
| `underline` | an underline draws in                                     |
| `fade`      | nearly disappears                                         |
| `shimmer`   | a silver sheen sweeps across                              |
| `ripple`    | wavers like a reflection in water                         |
| `shake`     | trembles in periodic bursts                               |
| `flicker`   | flickers like a failing light                             |
| `mirror`    | flips around like a reflection                            |
| `rise`      | surfaces from below once                                  |

Combine effects on one target (`focus bold: 2`) or on separate targets in one step
(`focus: 1-3; shake: 2 'word'`). Avoid stacking two effects that drive the same CSS
property on the same target, such as `fade` with `flicker` (both opacity) or `ripple`
with `rise` (both filter).

Users with "reduce motion" turned on still get the static effects, but not the movement.

## Files

- `index.html`: content (hero, poem, steps, outro)
- `css/style.css`: layout, typography, and every effect (search for `Effects`)
- `js/scrolly.js`: builds the poem, parses `data-fx`, and tracks scroll position
- `images/`: placeholder illustrations

To add an effect, add its name to `EFFECTS` in `js/scrolly.js`. Then style
`.fx-NAME > .text` (whole lines) and `.phrase.fx-NAME` (phrases) in the CSS.

Remove `data-show-fx` from `<body>` to hide the small `data-fx` labels shown under
each step.
