/**
 * PixelArtGenerator.ts
 * Procedural 16-bit sprite generation using HTML Canvas → Phaser textures.
 * All sprites are defined as pixel grids with palettes.
 *
 * STEAM NOTE: Replace these generated textures with real spritesheet PNGs by
 * loading them in PreloadScene.ts. The animation keys and frame counts are
 * already defined here — only the source changes.
 *
 * Encoding: each row is a string of chars. Each char maps to a hex color.
 * '.' = fully transparent pixel.
 */

import Phaser from "phaser";

// ─── Shared palettes ──────────────────────────────────────────────────────────

/** Player warrior palette */
const P_PLAYER: Record<string, number | null> = {
  ".": null,          // transparent
  "H": 0xFFD700,      // gold helmet
  "h": 0xAA8800,      // helmet shadow
  "A": 0x7090B0,      // armor blue
  "a": 0x4A6080,      // armor shadow
  "L": 0x9B6B3A,      // leather
  "l": 0x5C3A18,      // leather dark
  "S": 0xE8E8E8,      // sword bright
  "s": 0x9090A0,      // sword mid
  "E": 0xFF4400,      // eye red
  "W": 0xFFFFFF,      // white highlight
  "D": 0x1A1220,      // dark outline
  "G": 0xD4AF37,      // gold mid
  "g": 0x8B6914,      // gold dark
  "B": 0xC0B060,      // belt gold
  "k": 0x3A2810,      // boot dark
  "K": 0x6A4020,      // boot mid
  "C": 0xFFCC66,      // cape/cloth
  "c": 0xCC9933,      // cape shadow
  "X": 0xFF2200,      // damage red flash
  "v": 0x506070,      // visor slit
};

/** Scuttler (bone spider) palette */
const P_SCUTTLER: Record<string, number | null> = {
  ".": null,
  "B": 0xD4C89A,      // bone white
  "b": 0xA09060,      // bone shadow
  "E": 0xFF4400,      // eye
  "D": 0x1A1005,      // outline
  "L": 0xB8A070,      // light bone
  "c": 0x785030,      // claw dark
  "C": 0xB08050,      // claw
};

/** Brute (iron giant) palette */
const P_BRUTE: Record<string, number | null> = {
  ".": null,
  "I": 0x8090A0,      // iron
  "i": 0x506070,      // iron shadow
  "D": 0x1A1A2A,      // outline
  "R": 0xCC3300,      // red detail
  "E": 0xFF6600,      // eye glow
  "S": 0xC8C8C8,      // shoulder plates
  "s": 0x888888,      // plate shadow
  "B": 0x707080,      // body
  "b": 0x404050,      // body shadow
  "F": 0x5A4030,      // foot
  "H": 0x9A9AB0,      // helmet
  "h": 0x606070,      // helmet shadow
};

/** Wraith (shadow ghost) palette */
const P_WRAITH: Record<string, number | null> = {
  ".": null,
  "P": 0x7744BB,      // purple body
  "p": 0x44207A,      // purple dark
  "E": 0x00CCFF,      // eye blue
  "T": 0xAA66FF,      // teal highlight
  "D": 0x0D000D,      // dark
  "G": 0xCC88FF,      // glow
  "g": 0x8844AA,      // glow dark
  "W": 0xEECCFF,      // white wisp
};

/** Elite champion palette */
const P_ELITE: Record<string, number | null> = {
  ".": null,
  "R": 0xAA0000,      // crimson armor
  "r": 0x660000,      // armor shadow
  "G": 0xFFAA00,      // gold trim
  "g": 0xAA6600,      // gold shadow
  "I": 0xC0C0C0,      // silver
  "i": 0x808080,      // silver shadow
  "E": 0xFFFF00,      // eye yellow
  "D": 0x0A0005,      // dark outline
  "S": 0xE0E0E0,      // sword bright
  "s": 0xA0A0A0,      // sword mid
  "B": 0x1A000A,      // blackness
  "H": 0xCC0000,      // helm
  "h": 0x880000,      // helm shadow
};

/** Boss (Warden Reborn) palette */
const P_BOSS: Record<string, number | null> = {
  ".": null,
  "N": 0x110018,      // near black body
  "n": 0x220033,      // body highlight
  "E": 0xFF00FF,      // magenta eye
  "e": 0xAA00AA,      // eye glow
  "G": 0x880088,      // dark purple glow
  "C": 0x4400AA,      // deep purple
  "c": 0x220066,      // deep purple shadow
  "S": 0xCC44FF,      // scythe
  "s": 0x8800CC,      // scythe shadow
  "O": 0xFF88FF,      // outline glow
  "T": 0x330055,      // trim
  "W": 0xEE99FF,      // wisp
  "R": 0xFF2200,      // red accent
  "D": 0x050010,      // deep dark
};

/** Floor tile palette */
const P_FLOOR: Record<string, number | null> = {
  ".": null,
  "F": 0x1A0F28,      // floor base
  "f": 0x150B20,      // floor dark
  "L": 0x221535,      // lighter mortar
  "M": 0x0D0818,      // mortar/joint
  "H": 0x250F30,      // highlight tile
  "h": 0x1E0C28,      // hi-tile dark
  "C": 0x2D1040,      // cracked
  "c": 0x180820,      // crack dark
  "B": 0x3A0A0A,      // blood stain
  "b": 0x220505,      // blood dark
  "T": 0xFF9900,      // torch flame
  "t": 0xFF4400,      // torch base
  "G": 0x140022,      // dark gap
};

/** XP Orb palette */
const P_ORB: Record<string, number | null> = {
  ".": null,
  "B": 0x4444FF,      // blue orb
  "b": 0x2222AA,      // orb shadow
  "G": 0x88AAFF,      // orb glow
  "W": 0xCCDDFF,      // orb highlight
  "D": 0x0000AA,      // orb dark
};

// ─── Sprite frame data ────────────────────────────────────────────────────────

/** Player warrior — 16x16 pixels, multiple walk+attack frames */
const PLAYER_FRAMES: string[][] = [
  // ── Walk frame 1 (right foot fwd) ──
  [
    "................",
    "....HHHHHHHH....",
    "...HhhhhhhhH....",
    "...Hhv..vhhH....",
    "...HHhhhhhHH....",
    "...AAAAAAAAA....",
    ".S.AaAAAAAAaA...",
    "SS.AaAAAAAAaA...",
    ".s.AaAAAAAAaA...",
    "...BBBBBBBB.....",
    "...lLl..lLl.....",
    "...lLl..lKl.....",
    "...KLl..kKl.....",
    "...kKl..kk......",
    "...kk...k.......",
    "................",
  ],
  // ── Walk frame 2 ──
  [
    "................",
    "....HHHHHHHH....",
    "...HhhhhhhhH....",
    "...Hhv..vhhH....",
    "...HHhhhhhHH....",
    "...AAAAAAAAA....",
    ".S.AaAAAAAAaA...",
    "SS.AaAAAAAAaA...",
    ".s.AaAAAAAAaA...",
    "...BBBBBBBB.....",
    "...lLl..lLl.....",
    "...lKl..lLl.....",
    "...kKl..KLl.....",
    "...kk...kKl.....",
    "...k....kk......",
    "................",
  ],
  // ── Walk frame 3 (feet together / midstep) ──
  [
    "................",
    "....HHHHHHHH....",
    "...HhhhhhhhH....",
    "...Hhv..vhhH....",
    "...HHhhhhhHH....",
    "....AAAAAAAA....",
    ".S..AaAAAAAAa...",
    "SS..AaAAAAAAa...",
    ".s..AaAAAAAAa...",
    "....BBBBBBB.....",
    "....lLllLl......",
    "....lLllLl......",
    "....KLlkKl......",
    "....kKlkk.......",
    "....kk.k........",
    "................",
  ],
  // ── Walk frame 4 ──
  [
    "................",
    "....HHHHHHHH....",
    "...HhhhhhhhH....",
    "...Hhv..vhhH....",
    "...HHhhhhhHH....",
    "...AAAAAAAAA....",
    ".S.AaAAAAAAaA...",
    "SS.AaAAAAAAaA...",
    ".s.AaAAAAAAaA...",
    "...BBBBBBBB.....",
    "...lLl..lLl.....",
    "...lLl..lLl.....",
    "...KLl..lLl.....",
    "...kKl..KLl.....",
    "...kk...kKl.....",
    "................",
  ],
  // ── Attack frame 1 (wind-up) ──
  [
    "................",
    "....HHHHHHHH....",
    "...HhhhhhhhH....",
    "...Hhv..vhhH....",
    "...HHhhhhhHH....",
    "...AAAAAAAAA....",
    "...AaAAAAAAaA...",
    "...AaAAAAAAaA...",
    ".SSSSSSSSSSSSS..",
    "..ssssssssssss..",
    "...BBBBBBBB.....",
    "...lLl..lLl.....",
    "...lLl..lLl.....",
    "...kk...kk......",
    "................",
    "................",
  ],
  // ── Attack frame 2 (strike) ──
  [
    "................",
    "....HHHHHHHH....",
    "...HhhhhhhhH....",
    "...Hhv..vhhH....",
    "...HHhhhhhHH....",
    "...AAAAAAAAA....",
    "..SAaAAAAAAaA...",
    ".SSAaAAAAAAaA...",
    "SSsAaAAAAAAaA...",
    "..sAaAAAAAA.....",
    "...BBBBBBBB.....",
    "...lLl..lLl.....",
    "...lLl..lLl.....",
    "...kk...kk......",
    "................",
    "................",
  ],
  // ── Attack frame 3 (follow-through) ──
  [
    "................",
    "....HHHHHHHH....",
    "...HhhhhhhhH....",
    "...Hhv..vhhH....",
    "...HHhhhhhHH....",
    ".SSAAAAAAAAA....",
    "SSsAaAAAAAAaA...",
    ".ssAaAAAAAAaA...",
    "...AaAAAAAAaA...",
    "...BBBBBBBB.....",
    "...lLl..lLl.....",
    "...lLl..lLl.....",
    "...kk...kk......",
    "................",
    "................",
    "................",
  ],
  // ── Dash frame ──
  [
    "................",
    "...CHHHHHHHH....",
    "..CHhhhhhhhH....",
    "..CHhv..vhhH....",
    "..CHHhhhhhHH....",
    "..CAAAAAAAAA....",
    "..cAaAAAAAAaA...",
    "..cAaAAAAAAaA...",
    "SSSSS.AaAAAA....",
    "sssss..BBBB.....",
    "cccc.lLllLl.....",
    "ccc..lKllLl.....",
    ".....kk.kk......",
    "................",
    "................",
    "................",
  ],
  // ── Hit frame ──
  [
    "................",
    "....HHHHHHHH....",
    "...HXXXXXXXH....",
    "...HXXXXXXXH....",
    "...HXXXXXXXH....",
    "...XXXXXXXXX....",
    "...XXXXXXXXX....",
    "...XXXXXXXXX....",
    "...XXXXXXXXX....",
    "...XXXXXXXX.....",
    "...XLX..XLX.....",
    "...XLX..XLX.....",
    "...XX...XX......",
    "................",
    "................",
    "................",
  ],
];

/** Scuttler enemy — 16x16 */
const SCUTTLER_FRAMES: string[][] = [
  // Walk 1
  [
    "................",
    "....cCcCcCcc....",
    "...cCBBBBBBCc...",
    "..cC.BBBBBBB.Cc.",
    ".cC..bEbbbEb.Cc.",
    "CC...bBBBBBb..CC",
    "C....bBBBBBb...C",
    "CC...bBBBBBb..CC",
    ".cC..bbbbbbb.Cc.",
    "..cC.BBBBBBB.Cc.",
    "...cCBBBBBBCc...",
    "....cCcCcCcc....",
    "................",
    "................",
    "................",
    "................",
  ],
  // Walk 2
  [
    "................",
    "...cCcCcCccc....",
    "..cCBBBBBBBCc...",
    ".cC.bBBBBBBb.Cc.",
    "cC..bEbbbEbb.cC.",
    "C...bBBBBBBb...C",
    "CC..bBBBBBBb..CC",
    "C...bBBBBBBb...C",
    "cC..bbbbbbb..cC.",
    ".cC.BBBBBBB.Cc..",
    "..cCBBBBBBCc....",
    "...cCcCcCcc.....",
    "................",
    "................",
    "................",
    "................",
  ],
  // Walk 3
  [
    "................",
    ".....cCcCcCc....",
    "....cCBBBBBBCc..",
    "...cC.BBBBBBB.Cc",
    "..cC..bEbbbEb.cC",
    ".CC...bBBBBBb..C",
    ".C....bBBBBBb..C",
    ".CC...bBBBBBb..C",
    "..cC..bbbbbbb.cC",
    "...cC.BBBBBBB.Cc",
    "....cCBBBBBBCc..",
    ".....cCcCcCc....",
    "................",
    "................",
    "................",
    "................",
  ],
  // Walk 4
  [
    "................",
    "....cCcCcCcc....",
    "...cCBBBBBBCc...",
    "..cC.bBBBBBb.cC.",
    ".cC..bEbbbEb..cC",
    "CC...bBBBBBb...C",
    "C....bBBBBBb...C",
    "CC...bBBBBBb...C",
    ".cC..bbbbbbb..cC",
    "..cC.BBBBBBB.cC.",
    "...cCBBBBBBCc...",
    "....cCcCcCcc....",
    "................",
    "................",
    "................",
    "................",
  ],
];

/** Brute enemy — 20x20, rendered into 16x16 area via scaling */
const BRUTE_FRAMES: string[][] = [
  // Walk 1
  [
    "................",
    "....HHHHHHHH....",
    "...HhhhhhhhH....",
    "...HhEhhhEhH....",
    "...HhhhhhhhH....",
    "..SSHHHHHHHSS...",
    ".SSIIIiIiIISS...",
    ".SSIIIiIiIISS...",
    ".SIIIIiIiIIIS...",
    "..IIIIiIiIIII...",
    "...BBBBBBBBb....",
    "..IBBBBBBBBI....",
    "...IiBBBBiI.....",
    "...IIFFbFFII....",
    "...IFFFFbFFF....",
    "....FFFFFFFF....",
    "................",
    "................",
    "................",
    "................",
  ],
  // Walk 2
  [
    "................",
    "....HHHHHHHH....",
    "...HhhhhhhhH....",
    "...HhEhhhEhH....",
    "...HhhhhhhhH....",
    "..SSHHHHHHHSS...",
    ".SSIIIiIiIISS...",
    ".SSIIIiIiIISS...",
    ".SIIIIiIiIIIS...",
    "..IIIIiIiIIII...",
    "...BBBBBBBBb....",
    "..IBBBBBBBBI....",
    "...IiBBBBiI.....",
    "...IIbFFFFII....",
    "...IFFFbFFFF....",
    "....FFFbFFFF....",
    "................",
    "................",
    "................",
    "................",
  ],
];

/** Wraith enemy — 16x16 */
const WRAITH_FRAMES: string[][] = [
  // Float 1
  [
    "................",
    "....GGGGGG......",
    "...GpPPPPPGg....",
    "..GpPEpppEPPg...",
    "..GpPpppppPPg...",
    "..GpPPPPPPPPg...",
    "..GgPPPPPPPg....",
    "..GgPPPPPPPg....",
    "...gPPPPPPg.....",
    "...gPPPPPPg.....",
    "....gPPPPg......",
    "....gPppPg......",
    ".....gPPg.......",
    "......gg........",
    "................",
    "................",
  ],
  // Float 2 (slight rise)
  [
    "................",
    "................",
    "....GGGGGG......",
    "...GpPPPPPGg....",
    "..GpPEpppEPPg...",
    "..GpPpppppPPg...",
    "..GpPPPPPPPPg...",
    "..GgPPPPPPPg....",
    "...gPPPPPPPg....",
    "...gPPPPPPg.....",
    "....gPPPPg......",
    "....gPppPg......",
    ".....gPPg.......",
    "......gg........",
    "................",
    "................",
  ],
  // Float 3
  [
    "................",
    "....GGGGGGg.....",
    "...GpPPPPPPg....",
    "..GpPEpppEPg....",
    "..GpPPPPPPPg....",
    "..GgPPWPPPPg....",
    "...gPPPPPPPg....",
    "...gPPPPPPg.....",
    "....gPPPPg......",
    "....gPppPg......",
    ".....gPPg.......",
    "......gg........",
    "................",
    "................",
    "................",
    "................",
  ],
  // Float 4
  [
    "................",
    "...GGGGGGg......",
    "..GpPPPPPPg.....",
    ".GpPEpppEPPg....",
    ".GpPpppppPPg....",
    ".GpPPPWPPPPg....",
    ".GgPPPPPPPPg....",
    "..gPPPPPPPg.....",
    "..gPPPPPPg......",
    "...gPPPPg.......",
    "...gPppPg.......",
    "....gPPg........",
    ".....gg.........",
    "................",
    "................",
    "................",
  ],
];

/** Elite champion — 16x16 */
const ELITE_FRAMES: string[][] = [
  // Walk 1
  [
    "................",
    "...GHHHHHHHGg...",
    "..GrRRRRRRRRg...",
    "..GrRErrErRRg...",
    "..GrRRRRRRRRg...",
    "..GGRRRGGRRGg...",
    ".SSRRRRGGGRRSS..",
    "SSsRRRRGGGRRsS..",
    ".SsRRRRGGGRRSS..",
    "..RRRRRGGGRR....",
    "...rRRRGGRRr....",
    "...rRrrrrRRr....",
    "...rRr..rRRr....",
    "...rr...rrr.....",
    "................",
    "................",
  ],
  // Walk 2
  [
    "................",
    "...GHHHHHHHGg...",
    "..GrRRRRRRRRg...",
    "..GrRErrErRRg...",
    "..GrRRRRRRRRg...",
    "..GGRRRGGRRGg...",
    ".SSRRRRGGGRRSS..",
    "SSsRRRRGGGRRsS..",
    ".SsRRRRGGGRRSS..",
    "..RRRRRGGGRR....",
    "...rRRRGGRRr....",
    "...rRr..rRRr....",
    "...rRr..rRRr....",
    "...rrr..rrrr....",
    "................",
    "................",
  ],
];

/** Boss — 24x24 pixels rendered in a 16x16 display space via scaling */
const BOSS_FRAMES: string[][] = [
  // Boss 1
  [
    "................",
    "...SSSSSSSSS....",
    "..SNNnnnnNNNs...",
    ".SNNEEnnNEENNs..",
    ".SNnNeeeNeENns..",
    ".SNnNNNNNNNNns..",
    ".SNNNNcccNNNNs..",
    ".sNNNccCccNNNs..",
    "..sNNcCCCCcNNs..",
    "..TNNNNcNNNNTs..",
    "..TNNNNNNNNNTs..",
    "..TsNNNNNNNTs...",
    "...TssNNNNTs....",
    "....TssssTss....",
    "....cCccCCc.....",
    "....cCccCCc.....",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  // Boss 2
  [
    "................",
    "..SSSSSSSSSSS...",
    ".SNNnnnnNNNNNs..",
    "SNNEEnnNEENNNns.",
    "SNnNeeeNeENNNns.",
    "SNnNNNNNNNNNNns.",
    "SNNNNcccNNNNNNs.",
    "sNNNccCccNNNNNs.",
    ".sNNcCCCCcNNNs..",
    ".TNNNNcNNNNNTs..",
    ".TNNNNNNNNNNTs..",
    ".TsNNNNNNNTTs...",
    "..TssNNNNTss....",
    "...TssssTss.....",
    "...cCccCCc......",
    "...cCccCCc......",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  // Boss 3 (slight raise)
  [
    "................",
    "...SSSSSSSSS....",
    "..SNNnnnnNNNs...",
    ".SWNEEnnNEENs...",
    ".SWnNeeeNeENs...",
    ".SNnNNNNNNNNs...",
    ".SNNNNcccNNNs...",
    ".sNNNccCccNNs...",
    "..sNcCCCCCcNs...",
    "..TNNNNcNNNTs...",
    "..TNNNNNNNNTs...",
    "..TsNNNNNNTs....",
    "...TssNNNTs.....",
    "....TsssTss.....",
    "....cCccCCc.....",
    "....cCccCCc.....",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  // Boss 4
  [
    "................",
    "...SSSSSSSSS....",
    "..SNNnnnnNNNs...",
    ".SNNEEnnNEENNs..",
    ".SNnNeeeNeENns..",
    ".SNnNNNNNNNNns..",
    ".SNNNNcccNNNNs..",
    ".sNNNccCccNNNs..",
    "..sNNcCCCCcNNs..",
    "..TRRNNcNNNRTs..",
    "..TRNNNNNNNNTs..",
    "..TsNRNNNNRTs...",
    "...TssNNNNTs....",
    "....TssssTss....",
    "....cCccCCc.....",
    "....cCccCCc.....",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
];

/** XP orb — 8x8 */
const ORB_FRAMES: string[][] = [
  ["..GGGG..", "..GBBBg.", ".GBWBBBg", ".GBWBBBg", ".GBBBBBg", ".gBBBBg.", "..gBBg..", "...gg..."],
  ["..GGGG..", "..GBBBg.", ".GBBWBBg", ".GBBBBBg", ".GBBWBBg", ".gBBBBg.", "..gBBg..", "...gg..."],
  ["..GGGG..", "..GBBBg.", ".GBBBBBg", ".GWBBBBg", ".GBBBBBg", ".gBBBBg.", "..gBBg..", "...gg..."],
  ["..GGGG..", "..GBBBg.", ".GBBBBBg", ".GBBBBBg", ".GBBWBBg", ".gBBBBg.", "..gBBg..", "...gg..."],
];

/** Stone floor tile — 16x16, 3 variants */
const FLOOR_TILES: string[][] = [
  // Variant 1 — standard stone
  [
    "MMMMMMMMMMMMMMMM",
    "MFFFFFFFFFFFFFFF",
    "MFFFFFFFFFFFFffF",
    "MFFFFFFFFFFFFffF",
    "MFFFFFFFFFFFFffF",
    "MFFFFFFFFFFFFffF",
    "MFFFFFFFFFFFFffF",
    "MFFFFFFFFFFFMMMM",
    "MMMMMMMMMMMMMMMM",
    "FFFFFfffFFFFFFFF",
    "FFFFFfffFFFFFFFF",
    "FFFFFfffFFFFFFFF",
    "FFFFFfffFFFFFFFF",
    "FFFFFfffFFFFFFFF",
    "FFFFFfffFFFFFFFF",
    "MMMMMMMMMMMMMMMM",
  ],
  // Variant 2 — lighter stone
  [
    "MMMMMMMMMMMMMMMM",
    "MHHHHHHHHHHHHHH.",
    "MHHHHHHHHHHHHhH.",
    "MHHHHHHHHHHHHhH.",
    "MHHHHHHHHHHHHhH.",
    "MHHHHHHHHHHHHhH.",
    "MHHHHHHHHHHHHhH.",
    "MHHHHHHHHHHHMMMM",
    "MMMMMMMMMMMMMMMM",
    "HHHHHhhhHHHHHHH.",
    "HHHHHhhhHHHHHHH.",
    "HHHHHhhhHHHHHHH.",
    "HHHHHhhhHHHHHHH.",
    "HHHHHhhhHHHHHHH.",
    "HHHHHhhhHHHHHHH.",
    "MMMMMMMMMMMMMMMM",
  ],
  // Variant 3 — cracked stone
  [
    "MMMMMMMMMMMMMMMM",
    "MFFFFFCFfffFFFFF",
    "MFFFFcCFfffFFFFF",
    "MFFFccFFfffFFFFF",
    "MFFcCFFFFFFFFFFF",
    "MFcCFFCcFfFFFFFF",
    "MFcFFcCcFfFFFFFF",
    "MFFFFFFFFFFMMMM.",
    "MMMMMMMMMMMMMMMM",
    "FFFFFCcFFFFFFFFF",
    "FFFFCcFFFFFFFFFF",
    "FFFcCFFFFFFFFFFF",
    "FFcCFFFFFFFFFFFF",
    "FcCFffffFFFFFFFF",
    "FcFfffffFFFFFFFF",
    "MMMMMMMMMMMMMMMM",
  ],
];

/** Wall tile — 16x16 */
const WALL_TILE: string[] = [
  "GGGGGGGGGGGGGGGG",
  "GMMMMMMMMMMMMMMg",
  "GMFFFFFFFFFFFFMg",
  "GMFFFFFFFFFFFFMg",
  "GMFFFFFFFFFFFFMg",
  "GMFFFFFFFFFFFFMg",
  "GMFFFFFFFFFFFFMg",
  "GMFFFFFFFFFFFFMg",
  "GMFFFFFFFFFFFFMg",
  "GMFFFFFFFFFFFFMg",
  "GMFFFFFFFFFFFFMg",
  "GMFFFFFFFFFFFFMg",
  "GMFFFFFFFFFFFFMg",
  "GMFFFFFFFFFFFFMg",
  "GMMMMMMMMMMMMMMg",
  "GGGGGGGGGGGGGGGG",
];

/** Torch (animated) — 8x16 */
const TORCH_FRAMES: string[][] = [
  ["...TT...", "..TTTt..", ".TTtTTt.", "TTTtTTT.", ".TTtTT..", "..TTt...", "...t....", "...t...."],
  ["...TT...", "..TTtT..", ".TtTTTt.", ".TTTtTT.", "..TTtT..", "...Tt...", "...t....", "...t...."],
  ["..TTT...", ".TTtTt..", "TTTtTTt.", ".TTTtTT.", ".TTtTT..", "..Ttt...", "...t....", "...t...."],
  [".TTT....", "TTtTt...", ".TTTtTt.", ".TTtTTT.", "..TTtT..", "...TTt..", "...t....", "...t...."],
];

// ─── Texture generation ────────────────────────────────────────────────────────

function createSpriteCanvas(
  frames: string[][],
  palette: Record<string, number | null>,
  frameW: number,
  frameH: number,
  scale: number = 1,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = frames.length * frameW * scale;
  canvas.height = frameH * scale;
  const ctx = canvas.getContext("2d")!;

  frames.forEach((frame, fi) => {
    for (let row = 0; row < frameH; row++) {
      const rowStr = frame[row] ?? "";
      for (let col = 0; col < frameW; col++) {
        const char = rowStr[col] ?? ".";
        const color = palette[char];
        if (color === null || color === undefined) continue; // transparent
        ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
        ctx.fillRect(
          (fi * frameW + col) * scale,
          row * scale,
          scale,
          scale,
        );
      }
    }
  });

  return canvas;
}

/**
 * Add a canvas texture with explicit numbered frames so that
 * scene.anims.generateFrameNumbers() can find them.
 */
function addSheet(
  scene: Phaser.Scene,
  key: string,
  frames: string[][],
  palette: Record<string, number | null>,
  frameW: number,
  frameH: number,
  scale: number = 1,
): void {
  if (scene.textures.exists(key)) return;
  const canvas = createSpriteCanvas(frames, palette, frameW, frameH, scale);
  const texture = scene.textures.addCanvas(key, canvas)!;
  const dw = frameW * scale;
  const dh = frameH * scale;
  frames.forEach((_f, fi) => {
    texture.add(fi, 0, fi * dw, 0, dw, dh);
  });
}

/** Generate all game textures and register them with Phaser */
export function generateAllTextures(scene: Phaser.Scene): void {
  const addSingle = (key: string, rows: string[], palette: Record<string, number | null>, w: number, h: number, scale: number) => {
    if (scene.textures.exists(key)) return;
    const canvas = createSpriteCanvas([rows], palette, w, h, scale);
    scene.textures.addCanvas(key, canvas);
  };

  // ── Sprite sheets (with numbered frames) ────────────────
  addSheet(scene, "player_sheet",   PLAYER_FRAMES,   P_PLAYER,   16, 16, 3);
  addSheet(scene, "scuttler_sheet", SCUTTLER_FRAMES, P_SCUTTLER, 16, 16, 3);
  addSheet(scene, "brute_sheet",    BRUTE_FRAMES,    P_BRUTE,    16, 20, 3);
  addSheet(scene, "wraith_sheet",   WRAITH_FRAMES,   P_WRAITH,   16, 16, 3);
  addSheet(scene, "elite_sheet",    ELITE_FRAMES,    P_ELITE,    16, 16, 3);
  addSheet(scene, "boss_sheet",     BOSS_FRAMES,     P_BOSS,     16, 24, 3);
  addSheet(scene, "orb_sheet",      ORB_FRAMES,      P_ORB,       8,  8, 3);
  addSheet(scene, "torch_sheet",    TORCH_FRAMES,    P_FLOOR,     8,  8, 2);

  // ── Static textures (single frame, no animation) ─────────
  FLOOR_TILES.forEach((tile, ti) => {
    addSingle(`floor_tile_${ti}`, tile, P_FLOOR, 16, 16, 2);
  });
  addSingle("wall_tile", WALL_TILE, P_FLOOR, 16, 16, 2);
}

/** Register all Phaser animations. Call after generateAllTextures. */
export function registerAnimations(scene: Phaser.Scene): void {
  const anims = scene.anims;

  // ── Player ──────────────────────────────────────────────
  if (!anims.exists("player_walk")) {
    anims.create({ key: "player_walk",   frames: anims.generateFrameNumbers("player_sheet", { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
    anims.create({ key: "player_attack", frames: anims.generateFrameNumbers("player_sheet", { start: 4, end: 6 }), frameRate: 12, repeat: 0 });
    anims.create({ key: "player_dash",   frames: anims.generateFrameNumbers("player_sheet", { start: 7, end: 7 }), frameRate: 1, repeat: 0 });
    anims.create({ key: "player_hit",    frames: anims.generateFrameNumbers("player_sheet", { start: 8, end: 8 }), frameRate: 1, repeat: 0 });
    anims.create({ key: "player_idle",   frames: anims.generateFrameNumbers("player_sheet", { start: 0, end: 1 }), frameRate: 2, repeat: -1 });
  }

  // ── Enemies ──────────────────────────────────────────────
  if (!anims.exists("scuttler_walk")) {
    anims.create({ key: "scuttler_walk", frames: anims.generateFrameNumbers("scuttler_sheet", { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
  }
  if (!anims.exists("brute_walk")) {
    anims.create({ key: "brute_walk", frames: anims.generateFrameNumbers("brute_sheet", { start: 0, end: 1 }), frameRate: 3, repeat: -1 });
  }
  if (!anims.exists("wraith_walk")) {
    anims.create({ key: "wraith_walk", frames: anims.generateFrameNumbers("wraith_sheet", { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
  }
  if (!anims.exists("elite_walk")) {
    anims.create({ key: "elite_walk", frames: anims.generateFrameNumbers("elite_sheet", { start: 0, end: 1 }), frameRate: 4, repeat: -1 });
  }
  if (!anims.exists("boss_idle")) {
    anims.create({ key: "boss_idle", frames: anims.generateFrameNumbers("boss_sheet", { start: 0, end: 3 }), frameRate: 5, repeat: -1 });
  }

  // ── XP Orb ───────────────────────────────────────────────
  if (!anims.exists("orb_spin")) {
    anims.create({ key: "orb_spin", frames: anims.generateFrameNumbers("orb_sheet", { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
  }

  // ── Torch ────────────────────────────────────────────────
  if (!anims.exists("torch_flicker")) {
    anims.create({ key: "torch_flicker", frames: anims.generateFrameNumbers("torch_sheet", { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
  }
}

/** Map enemy type to spritesheet key and frame dimensions */
export const ENEMY_SPRITE_INFO: Record<string, { sheet: string; frameW: number; frameH: number; anim: string; scale: number }> = {
  scuttler: { sheet: "scuttler_sheet", frameW: 16 * 3, frameH: 16 * 3, anim: "scuttler_walk", scale: 1.0 },
  brute:    { sheet: "brute_sheet",    frameW: 16 * 3, frameH: 20 * 3, anim: "brute_walk",    scale: 1.2 },
  wraith:   { sheet: "wraith_sheet",   frameW: 16 * 3, frameH: 16 * 3, anim: "wraith_walk",   scale: 1.0 },
  elite:    { sheet: "elite_sheet",    frameW: 16 * 3, frameH: 16 * 3, anim: "elite_walk",    scale: 1.15 },
  boss:     { sheet: "boss_sheet",     frameW: 16 * 3, frameH: 24 * 3, anim: "boss_idle",     scale: 1.6 },
};
