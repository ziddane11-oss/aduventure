// pt18 — 발자국: 지난 회차에 간 길은 흐리게·아래로, 안 가 본 길은 위로 표시한다.
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

function fresh(store = {}) {
  const states = [];
  let index = 0;
  const data = new Map([['aduventure_lang', JSON.stringify('en')], ['aduventure_numbers', 'true'], ['aduventure_record_no', '114'], ...Object.entries(store).map(([k, v]) => [k, JSON.stringify(v)])]);
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
  vm.runInContext(app, ctx);
  const render = () => { index = 0; return vm.runInContext('CRPG()', ctx); };
  // 첫 화면 → 이름/직업 → 1장 도입
  byClass(render(), 'choice primaryChoice')[0].props.onClick();
  byClass(render(), 'card')[0].props.onClick();
  // 도입(선택지 1개) → 문(선택지 2개, 전사 기준)
  nodes(byClass(render(), 'choices')[0]).find(n => n.type === 'button').props.onClick();
  return {render, data, run: code => vm.runInContext(code, ctx)};
}
const choiceButtons = tree => nodes(byClass(tree, 'choices')[0]).filter(n => n.type === 'button' && /^choice( |$)/.test(n.props.className));

test('first visit: no marks, and the choice you make is remembered', () => {
  const g = fresh();
  const tree = g.render();
  const buttons = choiceButtons(tree);
  assert.ok(buttons.length >= 2);
  assert.equal(byClass(tree, 'tag path').length, 0, 'Nothing to compare with on a first visit');
  buttons[1].props.onClick();
  assert.deepEqual(JSON.parse(g.data.get('aduventure_taken')), ['intro:0', 'door:1']);
});

test('next run: roads taken before sink and fade, roads not taken rise and glow', () => {
  const g = fresh({aduventure_seen: ['door'], aduventure_taken: ['door:0']});
  const tree = g.render();
  const buttons = choiceButtons(tree);
  const labels = g.run(`SCENES.door.choices.map(c => c.label.en)`);
  const last = buttons.at(-1);
  assert.equal(last.props.className, 'choice walked');
  assert.ok(text(last).startsWith(labels[0]), 'The road you took last time is now at the bottom');
  assert.ok(text(last).includes('taken in a past record'));
  const top = buttons[0];
  assert.equal(top.props.className, 'choice fresh');
  assert.ok(text(top).includes('road not taken'));
  assert.equal(byClass(tree, 'pathNote').length, 0, 'Not every road walked yet');
});

test('when every road is walked, the game says so', () => {
  const g = fresh({aduventure_seen: ['door'], aduventure_taken: ['door:0', 'door:1']});
  const tree = g.render();
  assert.equal(text(byClass(tree, 'pathNote')[0]), 'You have walked every road from here.');
  assert.ok(choiceButtons(tree).every(b => b.props.className === 'choice walked'));
});

test('the case board counts crossroads that still have a road not taken (conditional roads do not count)', () => {
  const g = fresh();
  const count = (seen, taken) => g.run(`untakenCrossroads(${JSON.stringify(seen)}, ${JSON.stringify(taken)})`);
  assert.equal(count([], []), 0);
  assert.equal(count(['door', 'top'], []), 2);
  assert.equal(count(['door'], ['door:0']), 1);
  assert.equal(count(['door'], ['door:0', 'door:1']), 0, 'The wizard-only window does not count');
  assert.equal(count(['intro', 'ending', 'gameover', 'nowhere'], []), 0, 'One-way scenes and endings are not crossroads');
});

test('path text is bilingual', () => {
  const g = fresh();
  for (const k of ['pathFresh', 'pathWalked', 'pathAllWalked', 'pathLeft']) {
    const s = g.run(`UI.${k}`);
    assert.ok(s.ko && s.en, k);
    assert.equal(HANGUL.test(s.en), false, s.en);
  }
});

test('a crossroads you chose at before counts as visited even when resuming a save', () => {
  const g = fresh({aduventure_taken: ['door:1']});
  const buttons = choiceButtons(g.render());
  assert.deepEqual(buttons.map(b => b.props.className), ['choice fresh', 'choice walked']);
});
