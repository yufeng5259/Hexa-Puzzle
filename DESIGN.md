# Design

## Source of truth

- Status: Active for IAA Android V2; implementation/acceptance authority is `docs/version-1/iaa-android-v2/implementation-plan.md` and `acceptance-review.md`.
- Last refreshed: 2026-09-07
- Primary product surfaces: Home with daily hint, Map, Levels, Gameplay, Results, Settings/privacy options, rewarded hint, challenge failure, Legacy Records.
- Evidence reviewed: `docs/version-1/*`, `docs/migration/visual-fix/*`, `docs/migration/g008/*`, `assets/resources/prefabs`, `assets/resources/gameplay`, `assets/_legacy-ui/resources/external`, `assets/scripts/app/GameApp.ts`, `assets/scripts/gameplay/GameplayView.ts`

## Brand

- Personality: luminous deep-sea arcade toy; tactile, cheerful, focused, and easy to scan.
- Trust signals: immediate placement feedback, stable controls, clear resource balances, deterministic results.
- Avoid: flat dashboard styling, nested cards, heavy metallic framing, one-note blue screens, thin system typography, oversized in-panel headings, decorative gradients without gameplay meaning.

## Product goals

- Goals: preserve relaxed play, add a distinct move-limited challenge, make optional rewarded assistance useful, and retain old progress without inventing new achievements.
- Non-goals: payment, spendable coins, forced ads, banner/interstitial/app-open, collections, weekly rankings, rotation, distractors, cloud saves, iOS integration or engine migration.
- Success signals: both modes remain playable without ads, rewards settle once, controls remain stable, and all required viewport/physical Android gates have evidence.

## Personas and jobs

- Primary personas: casual mobile puzzle players, including returning players with existing progress.
- User jobs: resume quickly, understand where a piece can land, recover from mistakes, evaluate completion quality, replay or continue.
- Key contexts: one-handed portrait touch, desktop browser preview, short relaxed sessions, sound or vibration disabled.

## Information architecture

- Primary navigation: Home -> Map -> Level -> Gameplay -> Results -> Next/Replay/Levels.
- Core routes/screens: existing `PageFlow` routes remain authoritative.
- Content hierarchy: current goal and board first; draggable pieces second; resources/stats third; navigation/settings last.

## Design principles

1. Gameplay color belongs to pieces; chrome supports rather than competes.
2. Color is paired with rim, opacity, motion, or icon state so it is never the only cue.
3. Stable geometry matters more than decorative motion; dynamic values cannot resize controls.
4. Hexagons are the repeated brand shape for actions, resources, stars, and board feedback.
5. Low-star completion is success with a visible improvement path, not failure.

Tradeoff: preserve the recognizable glossy toy identity while reducing legacy plastic/metal heaviness and improving hierarchy.

## Visual language

- Color: canvas `#071523`/`#0B2438`; cyan `#20D2D9`; magenta action `#FF3F92`; gold reward `#FFD84D`; mint valid `#54F7B1`; orange wrong-valid `#FFB23E`; red invalid `#FF4E68`; main text `#E9FBFF`; subdued text `#A7D5E2`.
- Typography: reuse logo/bitmap assets where available. Page title 44-52, gameplay title 34-40, resource numbers 26-32, stats 22-26, result headline 58-70, button labels 24-30 at 720x1280. No viewport-scaled font sizes.
- Spacing/layout rhythm: 8px base; 16/24/32 gaps; 32px top visual margin; 64px bottom safe zone.
- Shape/radius/elevation: hex silhouettes for primary controls and chips; modal panels at 8px radius maximum; cyan rim plus short shadow rather than floating section cards.
- Motion: page fade/slide 0.16s; pickup 0.10s; return 0.20s; preview fade under 80ms; completion 1.2-2.0s. All gameplay Tweens are cancellable.
- Imagery/iconography: reuse `a2.jpg`, `a29.png`, tile textures, and bitmap fonts first. Icons remain familiar and are paired with accessible semantic node names.

## Components

- Existing components to reuse: authored page Prefabs, board/tray geometry, tile sprites, logo/background and page transition. Relaxed pages contain 20 levels; challenge pages contain 10.
- New/changed components: hint-only TopBar, daily claim, RewardHintDialog, ChallengeFailurePanel, LegacyRecordsPanel, Toast, Settings privacy entry and mode-specific WinOverlay.
- Variants and states: active/disabled, persistent hinted piece/target/conflicts, classic completion/unassisted badge, challenge 1/2/3 stars, rewarded loading/ready/showing/pending/unavailable/error.
- Token/component ownership: `assets/scripts/ui/PrefabContracts.ts` owns current required paths; `tools/ui-v5/generate-prefabs.mjs` authors them. Older Version 1 prefab/economy documents are historical.

## Accessibility

- Target standard: practical WCAG AA contrast for readable text and controls where Cocos rendering permits measurement.
- Keyboard/focus behavior: desktop preview actions expose stable focus/hover states; icon-only controls have semantic names and tooltips in the static prototype and equivalent test labels in Cocos.
- Contrast/readability: body/UI text uses main or subdued text tokens against dark surfaces; locked states differ by value, outline, and icon, not saturation alone.
- Screen-reader semantics: Cocos has limited DOM semantics; maintain semantic node names and deterministic labels for automated inspection.
- Reduced motion and sensory considerations: feedback cannot block input; effects and vibration are independently disabled; unsupported vibration silently degrades.

## Responsive behavior

- Supported verification viewports: 720x1280, 390x844, 428x926 and 1280x800 desktop.
- Layout adaptations: board and tray preserve dimensions and shift vertically; background uses cover behavior; top/bottom controls respect safe zones.
- Touch/hover differences: touch targets are at least 88px for bottom controls and 150px for Home Play; desktop hover never changes layout size.

## Interaction states

- Loading: preserve stable full-screen background and show one bounded progress state.
- Empty: zero hints can offer an optional +1 rewarded refill only when a valid hint exists; manual solving remains available. H5 reports ads unavailable.
- Error: invalid drop uses red proximity flash plus return motion; resource/contract errors use descriptive recovery or fatal state.
- Success: relaxed completion shows a completion/unassisted badge; challenge shows stars, moves, continues and hints used. Last-level Next routes to Levels. Result masks block hidden gameplay controls.
- Disabled: muted fill plus reduced opacity and unchanged dimensions.
- Offline/slow network: core play and daily claim are local; unavailable ads retain free replay and navigation. Pending receipt authority survives timeouts and page changes.

## Content voice

- Tone: concise, warm, and direct.
- Terminology: Relaxed / 轻松主线, Challenge / 限步挑战, Hints, Hints used, Moves left, Continues, Next, Replay, Levels. Inventory and consumed hints have distinct labels.
- Microcopy rules: show the exact optional reward (+1 hint or +3 moves), readable unavailable/pending states and free actions. Legacy Records identifies original data and never grants rewards.

## Implementation constraints

- Framework/styling system: Cocos Creator 3.8.8 and TypeScript; the Phase A HTML/CSS prototype is reference-only.
- Design-token constraints: no dependency or broad design-system framework; prefer existing Prefabs/assets and centralized semantic contracts.
- Performance constraints: no full-screen post-processing; animation state is interruptible and leaves no residual nodes.
- Compatibility constraints: preserve 80 classic payloads/order, archive original novice records, add 30 distinct challenge levels, keep alternate filled-board solutions valid, migrate save data once and preserve portrait/desktop input.
- Test/screenshot expectations: `npm test`, `npm run audit`, actual Cocos interactions at all four viewports, Android re-export/build and physical debug/minified QA rewarded flows. Synthetic receipt tests cannot replace SDK evidence.

## Open questions

- [ ] Physical Android test device and actual test-ad availability remain G010 evidence requirements.
- [ ] Final four-viewport verification and independent final review remain G011/G012; current evidence status is tracked in the IAA task document.
