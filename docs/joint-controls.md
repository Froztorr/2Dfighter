# Joint rotation controls

Pose Studio now exposes draggable torso and pelvis positions, and circular coronal/sagittal controls for torso, pelvis, neck, both shoulders, elbows, wrists and knees. Gold is coronal (local Z); blue is sagittal (local X). These are screen-facing angle dials, not perspective-projected anatomical planes. Numeric controls also expose axial rotation. Arrow keys adjust a focused ring by 1 degree, Shift+arrow by 5, Home resets that axis.

Diamond handles follow the actual weapon tip. Dragging one aims the weapon around its wrist while the equipment stays attached to the hand, including left-hand staffs and mirrored mixed weapons. Empty hands and shields have no weapon-tip handle. Torso, pelvis, palm and foot handles retain translation.

Joint offsets apply after the existing IK solution, keeping limb lengths and skinning intact. Manual shoulder/elbow/knee edits move downstream hands/feet away from their original IK targets; the editor explicitly explains this. During a two-hand cut the support hand blends back to the rotated hilt. Existing poses remain valid; new fields use the same validated, browser-local `emberblade-poses-v1` store and do not touch progression.

## Verification

- 45 Node tests pass, including both-side joint offsets and storage, arm/shin lengths, staff and mirrored weapon aiming, and support-hand contact/continuity with custom rotations.
- Browser: actual elbow-ring drag changed 0 to 45 degrees; keyboard knee/shoulder/neck rotation; actual torso drag; actual staff-tip drag; save/reload restored neck and shoulder values; animated cut preview; no console errors.
- Responsive checks at 390×844 and 320×667: no horizontal overflow; knee dial keyboard operation remained available.
- Browser tests used `localhost`, separate from the user's `127.0.0.1` pose/progression storage. The user's in-progress editor was not reloaded or reset.
- Evidence: `joint-controls.png`.

Limits: offsets are bounded but do not enforce anatomical self-collision or ground contact in manually rotated limbs. Extreme custom poses can still intersect equipment or leave the frame. Actual phone touch/performance was not tested.
