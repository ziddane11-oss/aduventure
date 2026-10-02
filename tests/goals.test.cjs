// pt27 — 이번 기록의 의뢰: 기록 번호로 정해지는 작은 목표 셋. 같은 번호면 같은 의뢰, 플래그가 채우면 ☑.
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

test('each record number commissions three distinct goals, the same every time', () => {
  const g = game({sceneKey: 'intro'});
  for (let no = 113; no < 400; no++) {
    const ids = [...g.run(`goalsFor(${no})`)];
    assert.equal(new Set(ids).size, 3, `record ${no}`);
    assert.deepEqual(ids, [...g.run(`goalsFor(${no})`)]);
  }
  const variety = new Set(Array.from({length: 40}, (_, i) => g.run(`goalsFor(${113 + i}).join()`)));
  assert.ok(variety.size >= 10, 'different records get different commissions');
});

test('the commission shows at the first scene and at chapter endings, ticked by flags', () => {
  const g = game({sceneKey: 'intro'});
  const box = g.goals();
  assert.ok(box, 'GoalBox at intro');
  assert.match(text(box), /This record's commission/);
  assert.match(text(box), /0\/3/);
  const ids = [...g.run('goalsFor(130)')];
  const satisfy = {ren: ['caughtRen'], light: ['fixed'], nofight: ['peaceful'], objection: ['rebut1'], rounds: ['lead1', 'lead2', 'lead3', 'lead4'],
    scully: ['peaceful2'], quiet: ['quiet3'], courier: ['saved3'], pieces: ['f_a', 'f_b']};
  const e = game({sceneKey: 'ending', flags: satisfy[ids[0]]});
  const done = e.goals();
  assert.ok(done, 'GoalBox at chapter ending');
  assert.match(text(done), /1\/3/);
  assert.equal(nodes(done).filter(n => n.props.className === 'goal done').length, 1);
});

test('every goal is written in both languages and only counts real progress', () => {
  const g = game({sceneKey: 'intro'});
  const all = JSON.parse(g.run('JSON.stringify(Object.keys(GOALS).map(k => GOALS[k].text))'));
  for (const t of all) { assert.ok(HANGUL.test(t.ko)); assert.ok(t.en && !HANGUL.test(t.en)); }
  assert.equal(g.run('GOALS.light.done(["fixed","lensCracked"])'), false);
  assert.equal(g.run('GOALS.rounds.done(["lead1","lead2","lead3"])'), false);
  const ko = game({sceneKey: 'intro', lang: 'ko'});
  assert.match(text(ko.goals()), /이번 기록의 의뢰/);
});
