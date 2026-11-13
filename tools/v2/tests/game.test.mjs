import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loader } from '../env.mjs';

const load = loader();
const { Game } = load('assets/scripts/core/Game');
const { Store } = load('assets/scripts/core/Store');
const { defaultRules } = load('assets/scripts/core/DefaultRules');
const rules = defaultRules(), config = { rules, maps: [], guide: [] };
function setup(now = Date.UTC(2026, 10, 9, 2)) {
    const data = new Map(), storage = { fail: false, writes: 0, getItem: k => data.get(k) ?? null, setItem(k, v) { if (this.fail) throw new Error('disk'); this.writes++; data.set(k, v); } };
    const clock = { t: now, now() { return this.t; }, offsetMinutes: () => 480 };
    return { storage, clock, game: new Game(config, new Store(storage, rules), clock) };
}

test('listeners hear only saved changes', () => {
    const { storage, game } = setup();
    let heard = 0; game.subscribe(() => heard++);
    game.act(s => { s.wallet.coins = 7; });
    storage.fail = true;
    assert.throws(() => game.act(s => { s.wallet.coins = 99; }));
    assert.equal(heard, 1);
    assert.equal(game.state.wallet.coins, 7);
});

test('tick writes only when energy recovery changes something', () => {
    const { storage, clock, game } = setup();
    game.tick();
    assert.equal(storage.writes, 0, 'full energy, nothing to save');
    game.act(s => { s.energy.value = 3; s.energy.anchor = clock.t; });
    const before = storage.writes;
    clock.t += 100 * 1000; game.tick();
    assert.equal(storage.writes, before);
    clock.t += 200 * 1000; game.tick();
    assert.equal(game.state.energy.value, 4);
});

test('day/week ids follow the clock and display queue is taken in order', () => {
    const { game } = setup();
    assert.equal(game.day(), '2026-11-09');
    assert.equal(game.week(), '2026-11-09');
    game.act(s => { s.displayQueue.push({ id: 'a', type: 'levelUp', reward: { coins: 0, energy: 1, hints: 0 } }, { id: 'b', type: 'levelUp', reward: { coins: 0, energy: 1, hints: 0 } }); });
    assert.equal(game.takeDisplay().id, 'a');
    assert.equal(game.takeDisplay().id, 'b');
    assert.equal(game.takeDisplay(), null);
});
