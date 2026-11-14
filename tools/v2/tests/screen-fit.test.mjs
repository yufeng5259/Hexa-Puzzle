import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loader, PROJECT } from '../env.mjs';

const F = loader()('assets/scripts/features/ui/FitMath');
const none = { top: 0, bottom: 0, left: 0, right: 0 };
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);

test('device class: Android smallest width decides; browser falls back to aspect', () => {
    assert.equal(F.isTablet(411, { width: 1080, height: 2400 }), false, 'phone');
    assert.equal(F.isTablet(411, { width: 1600, height: 1600 }), false, 'a phone stays a phone at any aspect (fill)');
    assert.equal(F.isTablet(768, { width: 1536, height: 2048 }), true, '3:4 tablet');
    assert.equal(F.isTablet(673, { width: 1768, height: 2208 }), true, 'unfolded foldable');
    assert.equal(F.isTablet(null, { width: 768, height: 1024 }), true);
    assert.equal(F.isTablet(null, { width: 1080, height: 1920 }), false);
});

test('phones fill: the frame is the whole safe area and contains the design area', () => {
    for (const [w, h] of [[1080, 1920], [1080, 2400], [1440, 3200], [720, 1600], [1200, 1600]]) {
        const fit = F.computeFit({ width: w, height: h }, none, false);
        near(fit.visible.width, fit.frame.width); near(fit.visible.height, fit.frame.height);
        assert.ok(fit.frame.width >= 853 - 1e-6 && fit.frame.height >= 1844 - 1e-6, `${w}x${h}`);
        assert.ok(Math.abs(fit.frame.width - 853) < 1e-6 || Math.abs(fit.frame.height - 1844) < 1e-6, 'one side fits exactly');
    }
});

test('notch / Dynamic Island: design area fits below it, backgrounds still reach the screen edge', () => {
    const fit = F.computeFit({ width: 1170, height: 2532 }, { top: 141, bottom: 102, left: 0, right: 0 }, false); // iPhone 15 Pro-like
    assert.ok(fit.frame.height >= 1844 - 1e-6);
    const s = fit.scale;
    near(fit.visible.height * s, 2532);
    near(fit.frame.y, (102 - 141) / 2 / s, 1e-6); // frame centre moves down with a taller top inset
    assert.ok(fit.frame.y + fit.frame.height / 2 <= fit.visible.height / 2 - 141 / s + 1e-6, 'frame top under the island');
});

test('tablets and unfolded foldables keep the design proportions, height-filling and centred', () => {
    for (const [w, h] of [[1536, 2048], [1768, 2208], [1600, 1600]]) {
        const fit = F.computeFit({ width: w, height: h }, none, true);
        assert.deepEqual([fit.frame.width, fit.frame.height], [853, 1844]);
        near(fit.visible.height, 1844);
        assert.ok(fit.visible.width > 853, 'sides left for the curtains');
        near(fit.frame.x, 0);
    }
});

test('map placement: covers when the buildings allow it, never pushes them under the HUD/bottom bar', () => {
    const bounds = JSON.parse(fs.readFileSync(path.join(PROJECT, 'assets/resources/config/map-bounds.json'), 'utf8')).maps;
    const bg = { width: 854, height: 1842 };
    for (const [id, b] of Object.entries(bounds)) {
        const rel = { top: b.top - 921, bottom: b.bottom - 921 }, pic = b.picture ?? { x: 0, y: 0, ...bg };
        for (const frame of [{ width: 853, height: 1844 }, { width: 1037, height: 1844 }, { width: 853, height: 1990 }]) {
            const p = F.placeMap(frame, rel, bg, { x: 0, y: 0, ...frame }, pic);
            assert.ok(p.scale >= 1 - 1e-9, `${id} never shrinks`);
            const d = -p.offsetY, top = frame.height / 2 + d + rel.top * p.scale, bottom = frame.height / 2 + d + rel.bottom * p.scale;
            assert.ok(top >= Math.min(160, 922 + rel.top) - 1e-6, `${id} ${frame.width}x${frame.height}: top building under HUD (${top})`);
            assert.ok(bottom <= frame.height - (1844 - Math.max(1550, 922 + rel.bottom)) + 1e-6, `${id}: bottom building under the bar (${bottom})`);
        }
        const exact = F.placeMap({ width: 853, height: 1844 }, rel, bg, { x: 0, y: 0, width: 853, height: 1844 }, pic);
        // Outpainted pics cover up to the design size; beyond that exact.scale >1.
        assert.ok(exact.scale < 1.01, `${id}: no upscaling at design size (${exact.scale})`);
        // Outpainting covers most tall phones (up to ~2042 design units = a 1080x2400 safe area).
        assert.ok(pic.height >= 2040, `${id}: picture is outpainted`);
    }
});

test('map bounds file is generated from the building pictures', async () => {
    const { mapBounds } = await import('../map-bounds.mjs');
    const fresh = await mapBounds();
    const saved = JSON.parse(fs.readFileSync(path.join(PROJECT, 'assets/resources/config/map-bounds.json'), 'utf8')).maps;
    assert.deepEqual(saved, fresh);
});

test('band scale: HUD and bottom bands grow with the width on wide phones only, capped', () => {
    const fit = (w, h, tablet = false) => F.computeFit({ width: w, height: h }, none, tablet);
    near(F.bandScale(fit(1080, 2400)), 1, 1e-9);
    near(F.bandScale(fit(1080, 1920)), F.BAND_SCALE_MAX, 1e-9);
    near(F.bandScale(fit(1080, 2100)), (1080 / 2100 * 1844) / 853, 1e-6);
    near(F.bandScale(fit(1536, 2048, true)), 1, 1e-9);
});
