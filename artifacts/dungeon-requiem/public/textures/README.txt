Drop Meshy (or any) PBR texture files here.
The game will auto-detect and use them, falling back to procedural textures if missing.

Expected files:

  FLOOR:
    floor_albedo.png     (color/diffuse map — seamless tileable)
    floor_normal.png     (tangent-space normal map)
    floor_roughness.png  (greyscale roughness — optional)

  WALLS:
    wall_albedo.png      (color/diffuse map — seamless tileable)
    wall_normal.png      (tangent-space normal map)
    wall_roughness.png   (greyscale roughness — optional)

Recommended: 1024x1024 or 2048x2048 resolution, PNG format.
Tiles repeat 8x8 on floor, 4x2 on walls — design for seamless tiling.
