# Visual review

These captures use the test build’s status hook to show consistent shell states; the hook is removed from the deployable production build. Each contact sheet contains all 20 games at the viewport and state named in its filename. Individual JPEG captures live in the matching viewport folder. [Block Stack board measurements](metrics.json) record the exact integer cell size and centered grid at each viewport.

| Viewport | Idle | Mid-play | Menu open | Game over |
|---|---|---|---|---|---|
| 320 × 568 | [Open](contact-320x568-idle.jpg) | [Open](contact-320x568-mid-play.jpg) | [Open](contact-320x568-menu-open.jpg) | [Open](contact-320x568-game-over.jpg) |
| 360 × 740 | [Open](contact-360x740-idle.jpg) | [Open](contact-360x740-mid-play.jpg) | [Open](contact-360x740-menu-open.jpg) | [Open](contact-360x740-game-over.jpg) |
| 390 × 844 | [Open](contact-390x844-idle.jpg) | [Open](contact-390x844-mid-play.jpg) | [Open](contact-390x844-menu-open.jpg) | [Open](contact-390x844-game-over.jpg) |
| 412 × 915 | [Open](contact-412x915-idle.jpg) | [Open](contact-412x915-mid-play.jpg) | [Open](contact-412x915-menu-open.jpg) | [Open](contact-412x915-game-over.jpg) |
| 740 × 360 | [Open](contact-740x360-idle.jpg) | [Open](contact-740x360-mid-play.jpg) | [Open](contact-740x360-menu-open.jpg) | [Open](contact-740x360-game-over.jpg) |

The individual files are named `<game>-<state>.jpg`, for example `320x568/block-stack-mid-play.jpg`. The real-device touch checklist is at [MANUAL_TEST.md](../MANUAL_TEST.md). Older paused/settings captures remain in the viewport folders as historical references.
