// pt27 — 인물의 맛: 장면마다 그 사람다운 한마디. 판마다 다른 말, 조건에 맞는 말만.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

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
    globalThis.api = {sceneKey, flags, fate, goto};
    const pct = choice =>`), ctx);
  data.set('aduventure_save', JSON.stringify({
    v: 1, sceneKey, flags, ruleKey: 'srd20', fate: 1, specialLeft: 2, breathLeft: 1, tutSeen: true, runNo: 130,
    pc: {...vm.runInContext('CLASSES.fighter', ctx), classKey: 'fighter', name: 'QA'}, stats: {rolls: 0, success: 0}
  }));
  const render = () => { index = 0; return vm.runInContext('CRPG()', ctx); };
  nodes(render()).find(n => n.props.className === 'continueBtn').props.onClick();
  const goals = () => expand(render(), 'GoalBox');
  const panel = () => expand(render(), 'ObjectionPanel');
  const card = () => { const el = nodes(render()).find(n => typeof n.type === 'function' && n.type.name === 'RecordCard'); return el.props.record; };
  const press = (cls, pick = 0) => nodes(panel()).filter(n => n.type === 'button' && n.props.className === cls)[pick].props.onClick();
  return {render, goals, panel, card, press, run: c => vm.runInContext(c, ctx), state: () => { render(); return ctx.api; }};
}

test('every line belongs to someone on stage and speaks both languages', () => {
  const g = game();
  const all = JSON.parse(g.run('JSON.stringify(Object.entries(BANTER).map(([k, v]) => [k, SCENE_CAST[k] || [], v, !!SCENES[k]]))'));
  assert.ok(all.length >= 15);
  for (const [scene, cast, lines, exists] of all) {
    assert.ok(exists, scene + ' is a real scene');
    for (const b of lines) {
      assert.ok(cast.includes(b.who), `${b.who} is on stage in ${scene}`);
      assert.ok(HANGUL.test(b.text.ko) && b.text.en && !HANGUL.test(b.text.en), scene);
    }
  }
});

test('the line is fixed for a record, changes between records, and respects what happened', () => {
  const g = game();
  assert.equal(g.run('banterFor("duel1", [], 130).text.en'), g.run('banterFor("duel1", [], 130).text.en'));
  const seen = new Set(Array.from({length: 12}, (_, i) => g.run(`banterFor("duel1", [], ${113 + i}).text.en`)));
  assert.equal(seen.size, 2, 'both duel1 lines show up across records');
  for (let no = 113; no < 140; no++) {
    assert.match(g.run(`banterFor("wharfRen", ["caughtRen"], ${no}).text.en`), /debt/);
    assert.match(g.run(`banterFor("wharfRen", [], ${no}).text.en`), /spat me out/);
  }
  assert.equal(g.run('banterFor("nowhere", [], 130)'), null);
});

test('the line sits under the cast on screen', () => {
  for (const lang of ['en', 'ko']) {
    const g = game({sceneKey: 'duel2', lang});
    const line = nodes(g.render()).find(n => n.props.className === 'banter');
    assert.ok(line, lang);
    assert.match(text(line), lang === 'en' ? /— Ren/ : /— 렌/);
  }
});
