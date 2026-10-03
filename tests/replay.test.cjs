// pt30 — 다시 하기 피로 줄이기: 전에 본 결과는 첫 문단만(펼치기 가능), 이미 기록한 장면은 선택지가 바로 뜬다.
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

function game({sceneKey = 'ending', flags = [], lore = [], lang = 'en', seenResults, seenScenes} = {}) {
  const states = [];
  let index = 0;
  const data = new Map([['aduventure_lang', JSON.stringify(lang)], ['aduventure_lore', JSON.stringify(lore)]]);
  if (seenResults) data.set('aduventure_rseen', JSON.stringify(seenResults));
  if (seenScenes) data.set('aduventure_seen', JSON.stringify(seenScenes));
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
    globalThis.api = {sceneKey, flags, fate, goto, hesitate, lastResult, pc, timerOn, doChoice, scene, applyBranch};
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

const result = tree => nodes(tree).find(n => typeof n.props.className === 'string' && n.props.className.startsWith('result '));

test('a result read before shows its first paragraph and can be opened; damage and clues stay in full', () => {
  // duel2 철사 길: 결과 문단이 둘(넘어감 + 철사 끊어짐)
  const fresh = game({sceneKey: 'duel2', flags: ['sawTrap']});
  let s = fresh.state(); s.doChoice(s.scene.choices[2]);
  assert.match(text(result(fresh.render())), /The taut wire has snapped/);
  const rid = fresh.state().lastResult.rid;
  const again = game({sceneKey: 'duel2', flags: ['sawTrap'], seenResults: [rid]});
  s = again.state(); s.doChoice(s.scene.choices[2]);
  const t = text(result(again.render()));
  assert.match(t, /tip over the railing together\. …/);
  assert.ok(!/wire has snapped/.test(t), 'the rest is folded');
  const open = nodes(again.render()).find(n => n.type === 'button' && /It went this way before/.test(text(n)));
  open.props.onClick();
  assert.match(text(result(again.render())), /The taut wire has snapped/);
});

test('replaying a chapter folds what the last record already saw, and its choices show at once', () => {
  const g = game({sceneKey: 'ending2'});
  const stage = () => nodes(g.render()).find(n => n.props.className === 'choices' && n.props['data-stage']);
  // 지난 판에 intro2를 봤다(저장소에 기록됨) → 2장 다시
  g.data.set('aduventure_seen', JSON.stringify(['intro2']));
  nodes(g.render()).find(n => n.type === 'button' && /Replay Ch\.2/.test(text(n))).props.onClick();
  assert.equal(g.state().sceneKey, 'intro2');
  assert.ok(nodes(g.render()).some(n => n.props.className === 'expandBtn' && /Already on record/.test(text(n))), 'the scene is folded');
  assert.equal(stage().props['data-stage'], 'instant');
});

test('the fold label speaks both languages', () => {
  const g = game();
  const t = JSON.parse(g.run('JSON.stringify(UI.resultSeen)'));
  assert.ok(HANGUL.test(t.ko) && !HANGUL.test(t.en));
});
