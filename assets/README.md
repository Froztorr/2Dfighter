# Enemy sprite sheets (2026-10-13)

Seven original ImageGen atlases replace all campaign enemies: brute, lizard, wraith, knight, frost, spider, demon. Dark medieval ink illustration, etched crosshatching, muted earth colors, worn metal and cloth, and ivory directional trails. The supplied references informed the overall visual treatment, not copied character designs.

Each RGBA atlas has 6 columns × 5 rows: **30 poses per enemy / 210 total**. Row zero: idle, breathing idle, guard, hurt, collapse, fallen. Directional rows: ready, anticipation, travel, contact, follow-through, settle. Contact begins at damage resolution. Guard impacts retain the same character; death uses collapse then fallen.

`enemy-animation.mjs` schedules poses. `enemy-atlas.mjs` stores measured transparent gutters and ground positions; regenerate with `python tools/measure-enemies.py`. Source PNGs are unchanged ImageGen originals. Rendering aligns frames to a common ground anchor without resizing individual poses. Knight/frost horizontal rows are reordered to match their painted trajectories. The brute uses wider gutters and small club-tip accents to avoid neighboring-frame bleed.

Generation brief: original full-body front-facing three-quarter monster; consistent anatomy, costume, weapon and camera; 30 separate poses on transparent alpha; six sequential poses per directional attack; left/right are screen coordinates; restrained ivory contact trails; no text, labels or grid. Designs: slate goblin executioner, moss-green falchion reaver, charcoal-robed ember wraith, black-iron crimson knight, ice poleaxe revenant, violet scythe-armed arachnid matriarch, ash-red execution-axe demon.

The player is composited at half size in the lower half of the combat viewport, bounding every hand/weapon animation.

# Equipment and defensive poses (2026-09-22)

## Campaign expansion

- `relics.png`: 1448 × 1086 RGBA, 4 × 3 inventory icons. Row 0 frost sword/shield/helm/plate; row 1 venom dagger/hook/silk cloak/spider pendant; row 2 inferno axe/demon staff/ruby ring/inferno robe. All 12 are distinct generated sprites used in inventory and held-item rendering; armor variants additionally tint the modular player layers.

Prompt constraints: centered isolated full-body poses, consistent identity and size, organic silhouettes, rich 16-bit shading, no labels or borders. Actual frame sizes and transparent gutters are validated by `tools/check-assets.py`.

Built-in ImageGen originals, no external stock assets. The supplied equipment screenshots guide layout only; their artwork/watermarks are not used.

- `gear.png`: 6 × 6 equal cells, 1254 × 1254 RGBA. Read order: rust sword, iron sword, mace, axe, greatsword, ember staff; oak shield, steel shield, dagger, venom dagger, fire wand, ice staff; helmet, hood, wizard hat, plate chest, leather chest, robe; plate trousers, leather trousers, cloth trousers, plate boots, rogue boots, mage boots; ruby ring, emerald ring, sapphire ring, moon ring, sun necklace, arcane pendant; red cape, green cloak, violet cloak, golden shield, assassin dagger, potion.
- `guards.png`: 4 × 2 equal cells, 1774 × 887 RGBA. Columns brute, lizard, wraith, knight; ready guard and impact guard rows.

Generation brief: richly shaded dark fantasy 16-bit pixel sprites, organic silhouettes, true transparent backgrounds, no text/borders. Gear: 36 individually specified centered icons. Hero: eight aligned neutral front/back characters, no weapons/capes; transparency refinement preserved layout. Guards: each monster braces its own club/shield/magic ward, then recoils with impact sparks. Assets are sliced only at rendering time; the validation script is read-only.

## First-person player sprites (2026-10-05)

All player art is newly generated original ImageGen pixel artwork with transparent RGBA backgrounds. The old hero and detached arm atlases were removed. Combat uses complete painted hands gripping their held items, rather than empty fists with inventory icons overlaid.

- `fps-<weapon>-plate.png`: thirteen 8 × 8 atlases, one for each main weapon. One-handed sheets contain the right forearm and held weapon; two-handed sheets contain both hands around the same handle. Fingers, handle, guard and weapon are painted together in every cell. The greatsword revision foreshortens the blade to fit the cell.
- `fps-offhand-{plain,plate,rogue,mage}.png`: 8 × 8 atlases. Rows: wood shield, steel shield, guardian shield, frost shield, parry dagger, assassin dagger, spider claw, empty hand. Shields expose the inside facing the player, with a held grip and straps. Columns represent raise, brace, impact and recovery poses.
- `fps-material-{blade,staff,heavy}-{plain,rogue,mage}.png`: 8 × 8 material references painted against the corresponding held-weapon plate sheets. Reference weapons can use their complete material sheet directly; other weapons use registered RGB material changes on their original complete atlas. This never changes alpha, moves fingers, or pastes a weapon onto a hand.
- `portrait.png`: four full-body front-view characters, plain linen / steel armor / forest leather / violet mage cloth. Equipment preview combines stationary clothing regions and accessories. Combat does not use this figure or any articulated limb geometry.

Main atlas rows: idle, right slash, left slash, rising slash, downward slash, guard/block, parry/cast, hurt/death. Each row has eight frames. The frame scheduler distinguishes windup, contact and recovery; block absorbs impact, dodge lowers the held items, stun holds stagger poses, death lowers the arms and fades the view. Native Phaser images play the frames without rotating player sprites.

Generation brief: first-person anatomical hands actually wrapped around the specified handle, visible finger overlap and thumb opposition, armored knuckles and wrist folds, consistent camera and proportions, rich dimensional 16-bit pixel shading, no empty fist pretending to hold a floating item, no UI or labels. Every held item must remain within its own frame. Original generated PNGs are copied unchanged; rendering slices equal cells. Automated asset checks validate transparency and nonempty cells; browser galleries permit visual review of grip and action poses.

`hall.png` remains the original ImageGen dark-fantasy fortress backdrop. `guards.png` is retained as source art; enemies use their own coherent guard/attack/hurt/death atlases and native Phaser frame transitions.
