# Authored stance A / attack B

Pose Studio now edits two independent poses per weapon family. A is the ready stance. Selecting B initially copies A; all position, joint-ring and weapon-tip controls then edit B only. The preview travels A → B → A over the existing 550 ms cut, reaching B at 275 ms. It returns to the A editor afterward. “Use original attack” removes B from the draft, and explicit save persists that change.

Position targets interpolate smoothly; rotational fields use shortest-path quaternion interpolation. Authored attacks bypass the stock cut offsets so the peak actually matches B instead of adding another animation over it. Any two-hand contacts in B must be authored by the user; stock attacks retain automatic support-hand joining.

The optional `attack` object is stored alongside existing A fields in `emberblade-poses-v1`. Validation allows only one nested pose, ignores invalid/unknown fields and retains old A-only saves. Inventory “ลองฟัน” uses these poses through the existing renderer. This change does not alter first-person combat arm animations, hit timing or damage.

## Verification

- 46 Node tests pass. New regression covers stored A/B separation, rejection of recursive attack data, shortest-angle interpolation across +170°/−170°, and every bone's position/orientation at A/start, B/contact and A/recovery.
- Browser: edited B position and wrist angle; switching to A retained A's original value; save/reload restored B; preview played and returned to A. Actual inventory with a one-hand weapon used the authored cut. No console errors.
- Ring visibility now correctly hides the SVG dials with the handles checkbox and during playback.
- Screenshots: `attack-pose-a.png`, `attack-pose-b.png`. Tests ran on the separate localhost origin, preserving the user's 127.0.0.1 editor and storage.

Physical-phone touch/performance and self-collision remain unverified/unimplemented. Geometric interpolation does not guarantee that arbitrary A/B choices avoid body intersections.
