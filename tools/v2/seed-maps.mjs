// Writes the 30-map tables of docs/v2/14 into config/excel (Maps, MapBuildings, BuildingStages,
// Rewards.scaleByMap, PlayerLevels to 160, Constants.mainlineLoopTransforms), then exports.
// Numbers come from core/DefaultRules (MAPS30 and friends, copied from 14 §4.2); names, chapters
// and speciality honey from 14 §6.2. A map whose art (地图/Mxx_建筑布局.json) is not delivered yet
// borrows M01–M03 in turn: its background, buildings and thumbnail point at the stand-in's art and
// Maps.placeholderOf names the stand-in (15 §9.1). Delivered layouts are used as they are.
// Run: node tools/v2/seed-maps.mjs --run   (then npm run config:export runs automatically)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { loader, PROJECT } from './env.mjs';

const require = createRequire(path.join(PROJECT, 'tools/meta/app.cjs'));
const xlsx = require('node-xlsx');
const { schemas } = require('./schema.cjs');
const { exportConfig } = require('./app.cjs');
const EXCEL = path.join(PROJECT, 'config/excel'), DOCS = path.join(PROJECT, 'docs/v2');
const ZH = {
    Maps: ['地图ID', '顺序', '名称', '章节', '特产蜜(副标题)', '收益系数', '背景资源ID', '缩略图资源ID', '占位借用地图(空=正式图)', '下一地图ID(空=最后一张)', '完工奖励ID'],
    MapBuildings: ['建筑ID', '所属地图', '槽位1-5', '名称', '脚点X(0左-1右)', '脚点Y(0上-1下)', '锚点X', '锚点Y', '宽度占地图比例', '水平翻转', '层级', '首次满级奖励ID'],
    BuildingStages: ['唯一ID', '建筑ID', '等级(0=初始)', '升入该级费用', '图片资源ID'],
    Rewards: ['奖励包ID', '金币', '体力', '提示', '金币按当前地图收益系数放大'],
    PlayerLevels: ['唯一ID', '等级', '升到下一级所需经验', '升到本级奖励ID'],
};

/** 14 §6.2: chapter (set on its first map), "name · honey" and the 5 building names per map. */
export function themes() {
    const text = fs.readFileSync(path.join(DOCS, '14_地图扩展_30图设计.md'), 'utf8');
    const cells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    let chapter = '';
    return text.split('\n').filter(l => /^\| M\d\d \| (一|二|三|四|五|六)/.test(l)).map(l => {
        const c = cells(l);
        if (c[1].includes('·')) chapter = c[1].split('·')[1].trim();
        const [name, subtitle] = c[2].split('·').map(s => s.trim());
        return { id: c[0], chapter, name, subtitle, buildings: c.slice(5, 10) };
    });
}

const layoutFile = id => fs.readdirSync(path.join(DOCS, '地图')).find(f => f === `${id}_建筑布局.json`);

export function seedMaps() {
    const R = loader()('assets/scripts/core/DefaultRules').defaultRules();
    const theme = themes();
    if (theme.length !== R.maps.length) throw new Error(`14 §6.2 lists ${theme.length} maps, DefaultRules ${R.maps.length}`);
    const delivered = R.maps.filter(m => layoutFile(m.id)).map(m => m.id);
    const tables = { Maps: [], MapBuildings: [], BuildingStages: [] };
    R.maps.forEach((map, i) => {
        const t = theme[i];
        if (t.id !== map.id) throw new Error(`map order ${t.id} vs ${map.id}`);
        const own = delivered.includes(map.id), art = own ? map.id : delivered[i % delivered.length];
        const layout = JSON.parse(fs.readFileSync(path.join(DOCS, '地图', layoutFile(art)), 'utf8'));
        const thumb = `UI/地图选择/map_thumb_${art.toLowerCase()}.png`;
        tables.Maps.push([map.id, i + 1, t.name, t.chapter, t.subtitle, map.incomeMult, `map.${art}.background`, thumb, own ? '' : art, map.nextMapId ?? '', map.completionRewardId ?? '']);
        map.buildings.forEach((b, slot) => {
            const p = layout.placements[slot];
            const name = own ? p.name : t.buildings[slot];
            tables.MapBuildings.push([b.id, map.id, slot + 1, name, p.normalized_feet[0], p.normalized_feet[1], +p.anchor[0].toFixed(4), +p.anchor[1].toFixed(4), p.render_width_fraction, p.flip_x, p.z_index, b.maxRewardId ?? '']);
            for (let lv = 0; lv <= b.costs.length; lv++) tables.BuildingStages.push([`${b.id}_L${lv}`, b.id, lv, lv ? b.costs[lv - 1] : 0, `building.${p.building}.L${lv}`]);
        });
    });
    tables.Rewards = Object.entries(R.rewards).map(([id, r]) => [id, r.coins, r.energy, r.hints, R.scaledRewards.includes(id)]);
    tables.PlayerLevels = R.levels.map((l, i) => [`Lv${i + 1}`, i + 1, l.expToNext, l.rewardId ?? '']);
    for (const [name, rows] of Object.entries(tables)) write(name, [ZH[name], Object.values(schemas[name]), Object.keys(schemas[name]), ...rows]);
    // Constants: keep every existing row, set the loop order.
    const constants = xlsx.parse(path.join(EXCEL, 'Constants.xlsx'))[0].data;
    const loop = JSON.stringify(R.loopTransforms), at = constants.findIndex(r => r[0] === 'mainlineLoopTransforms');
    if (at >= 0) constants[at] = ['mainlineLoopTransforms', 'json', loop]; else constants.push(['mainlineLoopTransforms', 'json', loop]);
    write('Constants', constants);
    return { maps: R.maps.length, delivered, report: exportConfig() };
}

function write(name, data) {
    const keys = data[2];
    if (name !== 'Constants' && (keys.length !== ZH[name].length || keys.join() !== Object.keys(schemas[name]).join())) throw new Error(`header ${name}`);
    fs.writeFileSync(path.join(EXCEL, `${name}.xlsx`), xlsx.build([{ name: 'Data', data }]));
}

if (process.argv.includes('--run')) { const r = seedMaps(); console.log(`maps ${r.maps}, own art ${r.delivered.join(' ')}`, JSON.stringify(r.report.rows)); }
