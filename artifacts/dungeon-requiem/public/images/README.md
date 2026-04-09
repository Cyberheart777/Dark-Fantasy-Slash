# Main menu key art

Drop your main-menu background image here as:

```
main-menu-bg.jpg
```

(or `.png` / `.webp` — then update `MENU_BG_URL` in `src/ui/MainMenu.tsx`
to match the extension).

Recommended size: **1920×1080 or larger**, landscape, compressed as JPEG
at ~80% quality for fast first-paint on the live URL. Transparency isn't
useful here since it's rendered full-viewport behind a dark overlay.

The CSS layering in `MainMenu.tsx` applies:
- a `rgba(0,0,0,0.35 → 0.55)` linear tint over the image
- plus the existing radial vignette on top

…so reasonably bright art still reads well against the title panel.
If the file is missing, the `background:` shorthand gracefully falls
through to the original purple radial gradient.
