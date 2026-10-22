// pt31 — 1000명 인터뷰 반영: 쓰러지면 그 장 처음부터, 망설임으로는 죽지 않음, 첫 기록에는 시간 제한 없음, 3장 끝 '다음 할 일'.
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
    v: 1, sceneKey, flags, ruleKey: 'srd20', fate: 1, specialLeft: 2, breathLeft: 1, tutSeen: true, runNo,
    pc: {...vm.runInContext('CLASSES.fighter', ctx), hp: (globalThis.__hp || 12), classKey: 'fighter', name: 'QA'}, stats: {rolls: 0, success: 0}
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

test('falling in Ch.2 lets you rewrite from the start of Ch.2, keeping Ch.1', () => {
  const g = game({sceneKey: 'ending', flags: ['sabotage']});
  g.state().goto('intro2');
  g.state().goto('scully1');
  g.state().goto('gameover');
  const btns = nodes(g.render()).filter(n => n.type === 'button' && /^restart/.test(n.props.className));
  assert.match(text(btns[0]), /Rewrite from the start of this chapter/);
  assert.match(text(btns[1]), /Start a new record from the beginning/);
  btns[0].props.onClick();
  const s = g.state();
  assert.equal(s.sceneKey, 'intro2');
  assert.ok(s.pc, 'no class re-pick');
  assert.ok([...s.flags].includes('sabotage'));
});

test('a timeout never knocks you out', () => {
  globalThis.__hp = 1;
  try {
    for (let i = 0; i < 20; i++) {
      const g = game({sceneKey: 'scully2'});
      g.state().hesitate();
      const s = g.state();
      assert.notEqual(s.sceneKey, 'gameover');
      assert.equal(s.pc.hp, 1);
    }
  } finally { delete globalThis.__hp; }
});

test('the very first record has no clock; it arrives from the second', () => {
  assert.equal(timerBox(game({sceneKey: 'duel2', runNo: 113}).render()), undefined);
  assert.ok(timerBox(game({sceneKey: 'duel2', runNo: 114}).render()));
});

test('the Ch.3 ending says what to do next at the very top', () => {
  const g = game({sceneKey: 'ending3', lore: ['f_receipt']});
  const epi = nodes(g.render()).find(n => n.props.className === 'scene epi');
  assert.equal(epi.children.find(Boolean).props.className, 'nextStep');
  assert.match(text(epi.children.find(Boolean)), /What to do next · Case board 1\/8/);
});
