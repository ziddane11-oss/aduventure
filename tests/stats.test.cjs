// pt27 — 다른 기록관의 선택 비율: GAS가 판마다 한 번씩 센 선택을 돌려주고, 고른 뒤 결과 아래 한 줄로 보인다.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const gas = fs.readFileSync(path.join(__dirname, '..', 'gas', 'notes-doGet.gs'), 'utf8');
const html = fs.readFileSync(process.env.GAME_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');
const app = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1].split('ReactDOM.createRoot')[0];
const HANGUL = /[가-힣]/;
function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...node.children.flatMap(nodes)];
}
function text(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(text).join('');
  return typeof node === 'object' ? text(node.children) : String(node);
}
const byClass = (tree, c) => nodes(tree).filter(n => n.props.className === c);
const expand = (tree, name) => { const el = nodes(tree).find(n => typeof n.type === 'function' && n.type.name === name); return el ? el.type({...el.props, children: el.children}) : null; };

function game({sceneKey = 'ending', flags = [], lore = [], lang = 'en'} = {}) {
  const states = [];
  let index = 0;
  const data = new Map([['aduventure_lang', JSON.stringify(lang)], ['aduventure_lore', JSON.stringify(lore)]]);
  const ctx = vm.createContext({
    console, Date, Math, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    window: {addEventListener() {}}, document: {documentElement: {}},
    fetch: async () => { throw new Error('Network disabled in unit tests'); },
    localStorage: {getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k)},
    React: {
      Fragment: 'fragment',
      createElement: (type, props, ...children) => ({type, props: props || {}, children}),
      useState(initial) {
        const i = index++;
        if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
        return [states[i], v => states[i] = typeof v === 'function' ? v(states[i]) : v];
      },
      useRef(initial) { const i = index++; if (!(i in states)) states[i] = {current: initial}; return states[i]; },
      useEffect() {}
    }
  });
  vm.runInContext(app.replace('  const pct = choice =>', `
    globalThis.api = {sceneKey, flags, scene, doChoice, setChoiceStats, pickShare};
    const pct = choice =>`), ctx);
  data.set('aduventure_save', JSON.stringify({
    v: 1, sceneKey, flags, ruleKey: 'srd20', fate: 1, specialLeft: 2, breathLeft: 1, tutSeen: true, runNo: 130,
    pc: {...vm.runInContext('CLASSES.fighter', ctx), hp: 12, classKey: 'fighter', name: 'QA'}, stats: {rolls: 0, success: 0}
  }));
  const render = () => { index = 0; return vm.runInContext('CRPG()', ctx); };
  nodes(render()).find(n => n.props.className === 'continueBtn').props.onClick();
  const goals = () => expand(render(), 'GoalBox');
  const panel = () => expand(render(), 'ObjectionPanel');
  const card = () => { const el = nodes(render()).find(n => typeof n.type === 'function' && n.type.name === 'RecordCard'); return el.props.record; };
  const press = (cls, pick = 0) => nodes(panel()).filter(n => n.type === 'button' && n.props.className === cls)[pick].props.onClick();
  return {data, render, goals, panel, card, press, run: c => vm.runInContext(c, ctx), state: () => { render(); return ctx.api; }};
}

function runGas(rows, parameter, cache = new Map()) {
  const ctx = vm.createContext({
    JSON, Math, Number, String,
    ContentService: {MimeType: {JSON: 'json', JAVASCRIPT: 'js'}, createTextOutput: body => ({body, mime: 'text', setMimeType(m) { this.mime = m; return this; }})},
    CacheService: {getScriptCache: () => ({get: k => cache.get(k) ?? null, put: (k, v) => cache.set(k, v)})},
    SpreadsheetApp: {openById: () => ({getSheetByName: () => ({
      getLastRow: () => rows.length + 1,
      getRange: (r, c, n) => ({getValues: () => rows.slice(r - 2, r - 2 + n)})
    })})}
  });
  vm.runInContext(gas, ctx);
  return ctx.doGet({parameter});
}
const tele = (run, choice_id, event = 'choice') => ['t', 'telemetry', 'duel2', 'p', event, JSON.stringify({v: 1, run_id: run, choice_id})];

test('GAS counts each run once per choice and ignores timeouts, skips and other rows', () => {
  const rows = [tele('r1', 'duel2:1'), tele('r1', 'duel2:1'), tele('r2', 'duel2:0'), tele('r3', 'duel2:1'),
    tele('r4', 'timeout:duel2'), tele('r5', 'skip:ch2'), tele('r6', 'duel2:1', 'combat_action'),
    ['t', 'note', 'duel2', '', '', '{"choice_id":"duel2:3"}'], tele('r7', 'evil scene!:1'), ['t', 'telemetry', 'x', 'p', 'choice', 'not json']];
  const cache = new Map();
  const res = runGas(rows, {action: 'stats'}, cache);
  assert.equal(res.mime, 'json');
  assert.deepEqual(JSON.parse(res.body), {ok: true, stats: {duel2: {0: 1, 1: 2}}});
  assert.equal(JSON.parse(runGas([], {action: 'stats'}, cache).body).stats.duel2[1], 2, 'cached for ten minutes');
  assert.equal(runGas(rows, {action: 'stats', callback: 'aduStats42'}).mime, 'js');
  assert.equal(runGas(rows, {action: 'stats', callback: 'alert(1)//'}).mime, 'json');
  assert.equal(runGas(rows, {}).body, 'alive');
  assert.ok(JSON.parse(runGas([], {action: 'notes'}).body).ok, 'notes still served');
});

test('the client keeps only clean counts and stays silent under ten runs', () => {
  const g = game();
  assert.equal(g.run('JSON.stringify(cleanStats({duel2: {"0": 3, "1": "7", x: 5, "2": -1}, "bad key!": {"0": 9}, top: null}))'), '{"duel2":{"0":3,"1":7}}');
  assert.equal(g.run('choiceShare({duel2: {0: 3, 1: 6}}, "duel2", 1)'), null);
  assert.equal(g.run('choiceShare({duel2: {0: 3, 1: 7}}, "duel2", 1)'), 70);
  assert.equal(g.run('choiceShare({duel2: {0: 10}}, "duel2", 2)'), 0);
  assert.equal(g.run('choiceShare(null, "duel2", 0)'), null);
});

test('after a choice the share of other recorders appears under the result, in both languages', () => {
  for (const [lang, re, rare] of [['en', /42% of other recorders took this road too/, /A rare road — only 5%/], ['ko', /다른 기록관의 42%도 이 길을 택했다/, /드문 길 — 다른 기록관의 5%만/]]) {
    for (const [counts, want] of [[{0: 29, 2: 21}, re], [{0: 95, 2: 5}, rare]]) {
      const g = game({sceneKey: 'duel2', flags: ['sawTrap'], lang});
      g.state().setChoiceStats({duel2: counts});
      const s = g.state();
      s.doChoice(s.scene.choices[2]);
      const line = nodes(g.render()).find(n => n.props.className === 'pickShare');
      assert.ok(line, lang);
      assert.match(text(line), want);
    }
  }
  const quiet = game({sceneKey: 'duel2', flags: ['sawTrap']});
  const s = quiet.state();
  s.doChoice(s.scene.choices[2]);
  assert.equal(nodes(quiet.render()).find(n => n.props.className === 'pickShare'), undefined, 'no server, no line');
});
