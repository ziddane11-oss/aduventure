// pt27 — 결투의 마지막 수에 시간 제한(끌 수 있음). 시간이 다 되면 망설임 → 첫 판정 선택지의 실패.
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
    globalThis.api = {sceneKey, flags, fate, goto, hesitate, lastResult, pc, timerOn};
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

const timerBox = tree => nodes(tree).find(n => typeof n.props.className === 'string' && n.props.className.startsWith('duelTimer'));

test('the last move of a duel shows a clock that can be turned off and stays off', () => {
  const g = game({sceneKey: 'duel2'});
  const box = timerBox(g.render());
  assert.ok(box, 'timer on duel2');
  const want = g.run('timerBudget(0, fmt(SCENES.duel2.text.en, {name: "QA"}).length, false)');
  assert.ok(want > 16 && want <= 46, 'first visit adds reading time');
  assert.match(text(box), new RegExp(want + 's before you falter'));
  assert.match(text(box), /then they move first/, 'pt39: says what happens when time runs out');
  nodes(box).find(n => n.props.className === 'timerToggle').props.onClick();
  assert.equal(g.data.get('aduventure_timer'), 'false');
  assert.match(text(timerBox(g.render())), /Clock off/);
  assert.equal(g.state().timerOn, false);
});

test('running out of time falls into the first check choice\'s failure, once', () => {
  const g = game({sceneKey: 'duel2'});
  const hp = g.state().pc.hp;
  g.state().hesitate();
  const s = g.state();
  assert.equal(s.sceneKey, 'railing');
  assert.match(s.lastResult.text, /You hesitated, and they moved first/);
  assert.ok(hp === 12 && s.pc.hp < hp, 'the counter lands');
  g.state().hesitate();
  assert.equal(g.state().sceneKey, 'railing', 'no second timeout off-scene');
});

test('only the three last-move scenes are timed, and the clock speaks both languages', () => {
  for (const k of ['scully2', 'monk2']) assert.ok(timerBox(game({sceneKey: k}).render()), k);
  for (const k of ['duel1', 'intro', 'scully1']) assert.equal(timerBox(game({sceneKey: k}).render()), undefined, k);
  const ko = game({sceneKey: 'scully2', lang: 'ko'});
  assert.match(text(timerBox(ko.render())), /망설일 시간 \d+초/);
  const g = game();
  for (const k of ['timerLeft', 'timerOff', 'timerOffNote', 'timerOn', 'timerHesitate']) {
    const t = JSON.parse(g.run(`JSON.stringify(UI.${k})`));
    assert.ok(HANGUL.test(t.ko) && t.en && !HANGUL.test(t.en), k);
  }
});

test('the clock gives reading time: the result above and, on a first visit, the scene itself', () => {
  const g = game();
  assert.equal(g.run('timerBudget(0, 0, true)'), 16, 'a known scene with nothing above: just the 16s');
  assert.equal(g.run('timerBudget(200, 60, true)'), 16 + 20, 'result text is always read');
  assert.equal(g.run('timerBudget(200, 60, false)'), 16 + 26, 'first visit also reads the scene');
  assert.equal(g.run('timerBudget(5000, 900, false)'), 16 + 30, 'capped');
});
