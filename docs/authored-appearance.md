# Authored poses and character appearance

The replacement export supplied on 2026-10-20 is bundled in `authored-poses.mjs` without altering any numeric values. It contains seven weapon families and six contact B poses. Dual short weapons have only A and retain the stock attack. Inventory and Pose Studio use these defaults; existing browser-local overrides still take precedence, including A-only overrides. Reset restores the bundled pose. Exports still contain saved overrides only.

Inventory cameras sample the full cut once per equipment/pose/view change and keep a stable frame throughout playback. This fixes clipping from the supplied staff and mixed-weapon contact poses without editing their joints. Studio retains its existing editing camera.

Character → หน้าตา provides six faces (three male and three female), eight hairstyles, six skin tones and six hair colors. All combinations use the same body, head bone and clothing rig. Faces change the modeled jaw, head proportions, brows, eyes and lips; hair is geometry attached to the head. Headwear hides the hairstyle and removing it restores the choice. This adds appearance choices, not a separate female body rig.

Choices save in `emberblade-v1.appearance`, independently of equipment and `emberblade-poses-v1`. Legacy and invalid saves receive validated defaults. Pose Studio reads the same saved appearance. The appearance page uses a close-up camera; normal inventory remains full-body.

Verification:

- `npm test`: 50 passing tests, including six-floor gameplay, all 48 face/hair combinations, headwear hide/restore, persistence, and authored attack endpoints.
- Exact deep comparison against the replacement export: seven poses unchanged.
- Browser art check: 136 sampled equipment/pose renders and 47 icons pass finite-skinning and unclipped-silhouette checks.
- Real UI: male/female face, hair/skin/color changes, rotation, reload persistence, and the supplied twin-sword A/B editor controls checked.
- 390×844 and 320×667 layouts inspected using actual game documents inside sized iframes. Browser viewport overrides did not consistently apply to existing background tabs; iframe screenshots are layout checks, not physical-phone tests.

Evidence: `character-appearance.png`, `appearance-options.png`, `appearance-mobile.png`.

Limits: the existing stylized body/material style remains; long hair has no cloth collision simulation. Manual joint rotations can still intersect the body. Physical-phone touch/performance is unverified.
