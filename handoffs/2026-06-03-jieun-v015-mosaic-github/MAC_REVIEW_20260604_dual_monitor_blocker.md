# Mac Review - Jieun v0.1.5 Dual Monitor Blocker

## Status

Do not deploy the current `v0.1.5` EXE artifacts to Oracle.

## Reported Issue

In a dual-monitor setup, capture only works on the primary monitor.

## Confirmed Root Cause

Reviewed `aixlife/aimax-viseo` PR #2 branch `feature/jieun-mosaic-editor-v015`.

### `src/main/windowManager.ts`

`openOverlayWindow()` uses only:

```ts
const primary = screen.getPrimaryDisplay()
const { x, y, width, height } = primary.bounds
```

This creates the capture overlay only over the primary monitor.

### `src/main/captureManager.ts`

`captureRectImage()` uses only:

```ts
const primary = screen.getPrimaryDisplay()
const sources = await desktopCapturer.getSources(...)
const source = sources[0]
```

This captures/crops against the primary monitor screenshot only.

### Related Risk

`get-screen-source()` also returns `sources[0]`, so recording may have the same primary-monitor-only limitation.

## Required Fix

1. Build capture overlay over the full virtual desktop bounds from `screen.getAllDisplays()`.
2. Convert overlay-local selection coordinates to global screen coordinates by adding the overlay window `x/y`.
3. Select the display that fully contains the selected global rectangle.
4. Match `desktopCapturer` source to the selected display via `source.display_id === display.id` where available.
5. Crop relative to the selected display bounds, not primary display bounds.
6. If the selection spans multiple monitors, show a clear unsupported message or implement multi-display composition.

## Required Windows Verification

After rebuilding, verify with the installed Setup EXE:

- Primary monitor: capture -> mosaic -> save.
- Secondary monitor: capture -> mosaic -> save.
- Text capture on secondary monitor if OCR path is expected to share the same capture function.
- Optional: spanning-monitor selection should fail clearly instead of silently cropping the wrong screen.

## GitHub Comment

A blocker comment was added to PR #2 on 2026-06-04 KST.
