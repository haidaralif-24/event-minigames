# Visual Theme: Adventure Island Exploration Map

This is the spec to build to from the start — not a redesign of something
that already exists. Read this before writing `Board.jsx` or any styling.

## Reference feeling
Bright, chunky, toy-like party game — think Mario Party's board screen or
mobile party games. Bold flat shapes, thick black
outlines, saturated primary-ish colors, rounded chunky UI, everything a
little bouncy. NOT glassmorphism, NOT neon/glow, NOT thin-line minimalism,
NOT a corporate dashboard look. The board should feel like a toy or a map
you'd unfold, not a data table.

## The board is a map, not a grid
This is the single most important rule: **do not build the board as a
`COLS × ROWS` CSS grid with tiles snaking row by row.** That reads as a
snake/checkers game, not an exploration map. Instead:

- Tiles sit along a winding path — a single long curve (S-shape, spiral,
  or loop) is enough; it doesn't need branches to feel like a map.
- Precompute tile positions as points along that path (SVG path
  `getPointAtLength`, or a hand-authored array of `{x, y}` curve points),
  not `row/col` grid math.
- Render a visible connecting trail (road, dotted line, footprints)
  between consecutive tiles so it reads as a route.
- Put background scenery behind the path — flat-shape terrain (grass,
  water, simple decorative props matching the palette below) so tiles sit
  *on* a landscape instead of floating on an empty background.
- Tile *type* (start/normal/bonus/penalty/finish) drives tile color/icon,
  never tile position — keep that data content-agnostic in
  `boardTiles.json`.

## Color
Bright, high-saturation palette on a light or warm-neutral background
(not dark navy/slate) so flat-color shapes and terrain pop. Team token
colors can be primary-ish and distinct; UI chrome and terrain should be
lighter/warmer so tokens read clearly as pieces on top of a map.

## Shape & line
Thick, consistent dark outlines on interactive elements — tiles, tokens,
buttons, dice. Generous rounded corners. No thin 1px borders — go chunky
(3-4px+).

## Typography
A rounded, heavy display font for headings/scores, paired with a plain
readable body font. Scores and dice results should be big and bouncy, not
just bold.

## Motion
Use framer-motion with spring/overshoot easing, not linear/ease-out CSS
transitions: squash-and-stretch on token landing, bounce on dice results,
pop-in on question reveals, and tokens should visibly travel along the
path when moving — never teleport between tiles.

## Stickman token
Should read as an actual character, not a 24×24 line icon: rounded head,
a bit of pose/personality, thick outline matching the rest of the UI,
filled with the team color. It's what players look at most on the board —
give it real visual weight.

## Legibility constraint
`/board` is viewed on a projector from across a room. Don't sacrifice
at-a-distance legibility for path complexity — a simple readable curve
beats an intricate winding path nobody can parse from the back row.

## What NOT to do
- Don't hardcode palette values per-component — define CSS variable tokens
  once (e.g. in `src/index.css`) and have components inherit them, so a
  future content pack could theoretically override a subset via a
  `theme.json` later.
- Don't build the grid-snake layout "for now" planning to fix it later —
  build the path-based layout from the first version of `Board.jsx`.
