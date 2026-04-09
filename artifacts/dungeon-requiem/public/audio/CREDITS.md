# Audio Credits

Dungeon Requiem ships with a procedural synth fallback for every sound key,
so the game is playable even if no audio files are present. When real audio
assets are dropped into this folder, add an entry below so attribution
(for CC-BY or similar licenses) is preserved in the final build.

## Directory layout

- `music/` — looping background tracks (menu ambient, combat loop)
- `sfx/`   — one-shot effects

## How to add an asset

1. Drop the file into `music/` or `sfx/`.
2. Update `src/audio/SoundData.ts` and set the matching key's `src` field
   to `/audio/sfx/yourfile.mp3` (or `/audio/music/yourfile.mp3`).
3. Add a line below with the source, author, license, and URL.

## Preferred royalty-free sources

- **freesound.org**          — CC0/CC-BY, huge SFX library
- **Pixabay Music**          — royalty-free, no attribution required
- **OpenGameArt.org**        — CC0 game-specific audio
- **Kevin MacLeod (incompetech.com)** — CC-BY, attribution required here

Avoid zapsplat's free tier for a free/EA release — attribution requirements
and redistribution limits apply.

## Attributions

<!--
Example entries — delete the examples and add your own as files are added.

### music/dungeon_loop.ogg
- Title: "Crypt Dweller"
- Author: Kevin MacLeod
- License: CC-BY 4.0
- URL: https://incompetech.com/music/royalty-free/mp3-royaltyfree/Crypt%20Dweller.mp3
- Used for: `music_dungeon` (combat loop)

### sfx/sword_swing_01.wav
- Title: "Sword Swing 2"
- Author: qubodup (freesound.org user)
- License: CC0
- URL: https://freesound.org/people/qubodup/sounds/170958/
- Used for: `attack_melee`
-->

_No file-backed audio currently shipped — procedural synth fallback in use._
