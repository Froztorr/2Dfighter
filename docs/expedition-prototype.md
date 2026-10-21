# 2.5D expedition checkpoint

The hall's embark action opens `expedition.html?floor=N`. This is a Three.js browser prototype, not a Unity migration. All six difficulty/reward tiers currently use the same courtyard and Sentinel prototype; they are not six newly authored maps.

- Free movement with wall collision; proximity and line of sight start a group encounter. Translation locks while yaw is limited to about 60 degrees either side and pitch is bounded. Aim selects the enemy to strike.
- Two Sentinels approach separate positions; a third guards the gate. Defeating the active group restores movement.
- The Sentinel has 96 frames: four walking viewpoints, frontal ready stance, four directional attacks, thrust, kick and cast. Every clip has eight distinct frames. Quarter views mirror for the opposite side.
- One articulated source in `sentinel-sprites.mjs` produces the atlas in `assets/moss-sentinel.png`. `expedition.html?bake=1&atlas=1` regenerates and displays it. Normal play loads the pre-rendered file.
- Three or four normal attacks precede a randomly selected special. Both categories can be shield-blocked; specials consume more guard. Enemies allow two or three hits before deflecting until a stun resets that allowance.
- Perfect parry and the cooldown-based stun pulse open attack windows. Projected slash effects, directional blood, damage numbers, hit tint, orbiting stun stars, camera shake and red damage vignette provide feedback.
- Equipment stats, first-person equipment, loot, gold, XP, daily events and progression use the existing save. Inventory and Pose Studio remain available from the hall.

## Verification

`npm test`: 57 passing tests. Includes the actual expedition update/input/reward functions, delayed contact, shield break, stun reset, death, persistence and an automated legal-input clear at all six difficulties. Existing equipment and legacy combat tests remain passing.

Browser inspection covered exploration, encounter lock, two enemies facing the player, changing target by dragging, stun and strike effects, and held shield (HP remained 100 while guard dropped to 42). Layouts inspected at 1100x650 and 390x844. GPU atlas checks found 96 nonempty, unclipped frames and eight distinct images per clip; see `sentinel-frame-checks.json`.

Screenshots: `expedition-combat.png` (earlier combat layout) and `expedition-mobile.png` (target switching and stun/hit feedback).

## Known limits

This is a playable checkpoint, not a claim of finished art or polished combat feel. Frame-time profiling, physical-phone touch/performance, 320px layout verification and a Unity comparison have not been completed. The original seven enemy types are not converted to directional world sprites. The old combat implementation remains in the source but embark now selects the expedition. The new mode does not expose the legacy staff rune gestures. No multiplayer or server-authoritative saves are introduced.
