# Real-device touch checklist

Use the live cabinet: https://rom-bar.github.io/gimbot/ . Browser emulation can verify layout and input events, but it cannot prove physical touch feel, haptic support, thumb reach, or browser chrome behavior. Leave a box checked only after testing it on a physical phone.

## Portrait board and thumb reach

- [ ] At 320–412 px wide, the play screen uses the full visible height without page scrolling; the board fills at least 90% of the screen width.
- [ ] In Block Stack Gestures mode, the board is at least half the viewport height; at 360×740 the playable grid cells remain at least 28 px, and at 390 px wide target at least 32 px.
- [ ] Open the menu and switch Block Stack to Buttons or Both. Left and Right are side-by-side within a 12 px gap and comfortable under the left thumb; Down is directly below as a wide soft-drop key.
- [ ] A and B are easy to distinguish under the right thumb, do not overlap, and remain within a 16 px margin of the screen edges.
- [ ] Try both left- and right-handed layouts; the pad and action cluster switch sides without clipping.
- [ ] Hold Left/Right: the game moves once immediately, waits about 140 ms, then repeats about every 40 ms. Try the Slow, Medium and Fast repeat choices.
- [ ] Hold Down: soft drop repeats at about 30 ms. Tap A to rotate and B to hard-drop; long-press A to rotate counter-clockwise.
- [ ] In Block Stack Gestures mode, a drag of about one cell width moves one cell, a tap rotates, a downward drag soft-drops, and a quick downward flick hard-drops.
- [ ] Switch among Buttons, Gestures, and Both; the preference is remembered per game. Verify the shared screen chrome remains the same in another game.
- [ ] Open the menu; test Controls, Sound, CRT and Restart. Confirm the screen dims/refreshes as expected and settings persist after reopening.
- [ ] Try Haptics, button size and opacity; button targets remain at least 56×56 px. Long-press a control; no browser context menu appears.
- [ ] Cancel a touch or move the app out of focus while holding a control; no input remains stuck.

## Block Stack

- [ ] The NEXT preview and optional HOLD slot stay as small overlays in the upper corners; neither obscures the active piece or essential play cues.
- [ ] The landing ghost matches where the shape will settle.
- [ ] After a piece lands, slide or rotate it briefly before it locks; lock delay is about 400 ms and resets at most 10 times.

## Landscape and keyboard

- [ ] At 740×360, the board sits between the directional pad and action buttons; safe areas do not cover either cluster and the page does not scroll.
- [ ] On desktop, verify keyboard controls still work (arrows/WASD, Space/A, P/Esc, R) and focus indicators are visible.

## Automated layout snapshot

Playwright covers 320×568, 360×740, 390×844, 412×915 and 740×360. Automated results verify board width/height, integer cell size, control spacing, safe margins, no overlap, page scroll, gesture mapping, repeat timing and stuck-input recovery. Physical thumb reach and actual vibration still need the checks above on a phone.

Block Stack cell size is the largest integer that fits the canvas (`floor(min(canvas width / 10, canvas height / 20))`); the grid is centered. Final measured dimensions:

| Viewport | Canvas | Cell | Board | Grid offset |
|---|---:|---:|---:|---:|
| 320×568 | 318×484 px | 24 px | 240×480 px | (39, 2) px |
| 360×740 | 358×656 px | 32 px | 320×640 px | (19, 8) px |
| 390×844 | 388×760 px | 38 px | 380×760 px | (4, 0) px |
| 412×915 | 410×831 px | 41 px | 410×820 px | (0, 5) px |
| 740×360 | 215×284 px | 14 px | 140×280 px | (37, 2) px |
