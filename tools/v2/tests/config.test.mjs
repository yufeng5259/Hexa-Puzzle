import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loader, PROJECT } from '../env.mjs';

const load = loader();
const { parseGameConfig } = load('assets/scripts/core/Config');
const { defaultRules } = load('assets/scripts/core/DefaultRules');
const raw = () => JSON.parse(fs.readFileSync(path.join(PROJECT, 'assets/resources/config/game-config.json'), 'utf8'));

test('the exported Excel config produces exactly the planning default rules', () => {
    const { rules } = parseGameConfig(raw());
    assert.deepEqual(JSON.parse(JSON.stringify(rules)), JSON.parse(JSON.stringify(defaultRules())));
});

test('map views carry the art layout and one asset per building level', () => {
    const { maps, guide } = parseGameConfig(raw());
    assert.deepEqual(maps.map(m => m.id), ['M01', 'M02', 'M03']);
    assert.equal(maps[0].name, '晨露蜂园');
    const b01 = maps[0].buildings[0];
    assert.equal(b01.id, 'B01');
    assert.deepEqual([b01.feetX, b01.feetY, b01.widthFraction], [0.5, 0.36, 0.64]);
    assert.deepEqual(b01.assetIds, ['building.B01.L0', 'building.B01.L1', 'building.B01.L2', 'building.B01.L3', 'building.B01.L4', 'building.B01.L5']);
    for (const m of maps) assert.equal(m.buildings.length, 5);
    assert.deepEqual(guide.map(g => g.id), ['drag1', 'drag2', 'drag3', 'home', 'build', 'upgrade', 'construct', 'welcome']);
});

test('parsed config is frozen and malformed input is rejected', () => {
    const config = parseGameConfig(raw());
    assert.throws(() => { config.rules.rewards.welcome.coins = 9; });
    assert.throws(() => parseGameConfig({ schemaVersion: 1, tables: {} }), /schema/);
    const bad = raw();
    bad.tables.Constants.energyMax[2] = 'five';
    assert.throws(() => parseGameConfig(bad), /energyMax/);
    const missing = raw();
    missing.tables.Mainline.L001[4] = 'nope';
    assert.throws(() => parseGameConfig(missing), /unknown reward/);
});
