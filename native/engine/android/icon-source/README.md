# Android launcher icon

`source.png` is the original 1024 x 1024 image supplied on 2026-09-15.
The image is artwork, not project instructions.

Run `python generate.py` from this directory with Python 3, Pillow and NumPy.
The generator writes directly to `../res`, the persistent Cocos Android source
resource directory used by `app/build.gradle`. Do not copy resources into the
generated `build/android/proj/res` tree: duplicate names there can break merging.
The script uses Windows Arial only for the review sheet labels.

- Android 6–7.1: original composition with a rounded silhouette and 2dp optical
  inset in 48/72/96/144/192px mipmaps. Circular
  launchers get an individually masked round fallback.
- Android 8+: separate full-bleed background and transparent foreground layers,
  each 432px at xxxhdpi (108dp). Original tile pixels are retained; the blue
  honeycomb backdrop is extended procedurally to support launcher animation.
  The complete foreground, including feathering, fits a centered radius of
  less than 33dp. Adaptive layers have no pre-applied launcher shape or added
  outer container shadow.
- Android 13+: a separate vector monochrome layer depicts six separated tiles.
  The system selects the tint. Following the official XML example, the v26
  adaptive XML also declares monochrome; older Android versions ignore it.
- `android:icon` and `android:roundIcon` point to matching resources. On API 26+
  the launcher applies its own shape to both.

Review sheet, 1080px source layers, a 512px Google Play export, and a resource
hash/size report are written to `Project/output/android-icon/` (not shipped).
The preview crops the central 72dp viewport before applying launcher masks.
The Google Play PNG is a separate square, unmasked store upload asset.

Validation: generator checks alpha extent against the 66dp circular safe area,
background opacity, monochrome geometry, and XML syntax. Android resource
linking and lint must also be run after regeneration:

```powershell
./tools/android/build.ps1 -JavaHome 'C:/Users/Administrator/.jdks/ms-17.0.15' -Tasks ':Project:processDebugResources',':Project:processReleaseResources',':Project:lintDebug'
```

References:
- https://developer.android.com/develop/ui/compose/system/icon_design_adaptive
- https://developer.android.com/studio/write/create-app-icons
- https://developer.android.com/training/multiscreen/screendensities
- https://support.google.com/googleplay/android-developer/answer/9866151
