// pt35 — 한 장씩 끊어 하기: 이야기가 이어지는 장 끝에서는 이어하기 저장을 지우지 않고, 첫 판엔 '여기서 멈춰도 된다'를 보여 준다.
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

function game({sceneKey = 'ending', flags = [], lore = [], lang = 'en', runNo = 130} = {}) {
  let effects = [];
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
      useEffect(fn) { effects.push(fn); }
    }
  });
  vm.runInContext(app.replace('  const pct = choice =>', `
    globalThis.api = {sceneKey, flags, fate, goto};
    const pct = choice =>`), ctx);
  data.set('aduventure_save', JSON.stringify({
    v: 1, sceneKey, flags, ruleKey: 'srd20', fate: 1, specialLeft: 2, breathLeft: 1, tutSeen: true, runNo,
    pc: {...vm.runInContext('CLASSES.fighter', ctx), classKey: 'fighter', name: 'QA'}, stats: {rolls: 0, success: 0}
  }));
  const render = () => { index = 0; effects = []; const t = vm.runInContext('CRPG()', ctx); for (const fn of effects) { try { fn(); } catch (e) {} } return t; };
  nodes(render()).find(n => n.props.className === 'continueBtn').props.onClick();
  const goals = () => expand(render(), 'GoalBox');
  const panel = () => expand(render(), 'ObjectionPanel');
  const card = () => { const el = nodes(render()).find(n => typeof n.type === 'function' && n.type.name === 'RecordCard'); return el.props.record; };
  const press = (cls, pick = 0) => nodes(panel()).filter(n => n.type === 'button' && n.props.className === cls)[pick].props.onClick();
  return {data, render, goals, panel, card, press, run: c => vm.runInContext(c, ctx), state: () => { render(); return ctx.api; }};
}

const saved = g => JSON.parse(g.data.get('aduventure_save') || 'null');
for (const sceneKey of ['ending', 'ending2', 'ending3', 'c2_end', 'c2_end2', 'c2_end3']) {
  test(`${sceneKey}: 장 끝에 도달해도 이어하기 저장이 남고, 그 자리(장 끝)를 가리킨다`, () => {
    const g = game({sceneKey, runNo: 113});
    g.render(); g.render();
    const s = saved(g);
    assert.ok(s, '저장이 남아 있다');
    assert.equal(s.sceneKey, sceneKey);
  });
}
for (const sceneKey of ['ending4', 'fin_end']) {
  test(`${sceneKey}: 마지막 엔딩에선 예전처럼 이어하기 저장을 비운다`, () => {
    const g = game({sceneKey, runNo: 113});
    g.render(); g.render();
    assert.equal(saved(g), null);
  });
}
test('첫 판의 장 끝에만 멈춤 안내가 보이고, 두 번째 판부터는 없다', () => {
  for (const lang of ['ko', 'en']) {
    const first = nodes(game({sceneKey: 'ending', runNo: 113, lang}).render()).find(n => n.props.className === 'pauseOk');
    assert.ok(first, lang);
    if (lang === 'en') assert.ok(!HANGUL.test(text(first)), text(first));
    assert.ok(!nodes(game({sceneKey: 'ending', runNo: 114, lang}).render()).some(n => n.props.className === 'pauseOk'));
  }
  assert.ok(!nodes(game({sceneKey: 'ending4', runNo: 113}).render()).some(n => n.props.className === 'pauseOk'), '마지막 엔딩엔 없다');
});
