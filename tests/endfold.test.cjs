// pt34 — 장 끝 화면: 이어 가기 버튼을 정리(의뢰·지킨 것·기록·통계) 위로, 정리는 접어 둔다.
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

const order = tree => nodes(tree).map(n => (n.props.className || '') + (n.type === 'details' ? '#details' : ''));
for (const [sceneKey, flags] of [['ending', ['sabotage', 'trail']], ['ending2', ['ledger']], ['ending3', []], ['c2_end', []], ['c2_end3', ['c2f_pay']]]) {
  test(`${sceneKey}: 이어 가기 버튼이 접힌 정리보다 앞에 있고, 정리 안에 지킨 것·기록 범위가 들어 있다`, () => {
    const g = game({sceneKey, flags});
    const tree = g.render();
    const all = nodes(tree);
    const det = all.find(n => n.type === 'details' && n.props.className === 'endMore');
    assert.ok(det, '정리 접기가 있다');
    assert.ok(!det.props.open, '처음엔 접혀 있다');
    const inside = nodes(det.children);
    assert.ok(inside.some(n => n.props.className === 'ledger'), '지킨 것과 잃은 것은 정리 안에');
    assert.ok(inside.some(n => n.props.className === 'stats'), '통계도 정리 안에');
    assert.ok(!all.filter(n => !inside.includes(n)).some(n => n.props.className === 'ledger'), '바깥에 중복 없음');
    const o = order(tree);
    assert.ok(o.indexOf('restart primary') >= 0 && o.indexOf('restart primary') < o.indexOf('endMore#details'), '버튼이 먼저');
    const sum = text(det.children[0]);
    assert.match(sum, /Chapter summary/);
    assert.ok(!HANGUL.test(sum), '영어 요약줄에 한국어 없음: ' + sum);
  });
}
test('1~4장 끝에서는 의뢰 진행이 요약줄에 보인다', () => {
  const g = game({sceneKey: 'ending', flags: ['sabotage']});
  const det = nodes(g.render()).find(n => n.type === 'details');
  assert.match(text(det.children[0]), /Commission \d\/3/);
  assert.ok(nodes(det.children).some(n => typeof n.type === 'function' && n.type.name === 'GoalBox'));
});
test('정리를 펼치면 다음에도 펼친 채로 보인다', () => {
  const g = game({sceneKey: 'ending', flags: []});
  const det = nodes(g.render()).find(n => n.type === 'details');
  det.props.onToggle({target: {open: true}});
  assert.equal(nodes(g.render()).find(n => n.type === 'details').props.open, true);
  nodes(g.render()).find(n => n.type === 'details').props.onToggle({target: {open: false}});
  assert.ok(!nodes(g.render()).find(n => n.type === 'details').props.open);
});
test('이의 있음: 시작 전엔 제목 없이 버튼 하나, 누르면 제목과 함께 펼쳐진다', () => {
  const g = game({sceneKey: 'ending', flags: ['sabotage', 'trail']});
  let p = g.panel();
  assert.equal(p.props.className, 'objection idle');
  assert.ok(!nodes(p).some(n => n.type === 'h4'));
  g.press('choice objStart');
  p = g.panel();
  assert.ok(nodes(p).some(n => n.type === 'h4'));
});
test('개인 최고 기록 알림은 한 줄로 짧다', () => {
  const g = game({sceneKey: 'ending'});
  assert.equal(g.run('UI.newRecord.ko'), '★ 개인 최고 기록!');
  assert.equal(g.run('UI.newRecord.en'), '★ Personal best!');
});
