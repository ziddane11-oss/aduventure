// pt20 — 흉터: 실패한 판정은 다음 기록부터 그 기술의 장애물을 1 낮춘다(최대 2).
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

function game({sceneKey = 'door', scars = null, lang = 'en'} = {}) {
  const states = [], intervals = [];
  let index = 0, luck = 0;
  const data = new Map([['aduventure_lang', JSON.stringify(lang)], ['aduventure_numbers', 'true']]);
  if (scars) data.set('aduventure_scars', JSON.stringify(scars));
  const ctx = vm.createContext({
    console, Date, Math: Object.assign(Object.create(Math), {random: () => luck}),
    setTimeout: () => 0, clearTimeout() {},
    setInterval: fn => intervals.push(fn) - 1, clearInterval: id => intervals[id] = null,
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
    globalThis.api = {sceneKey, goto};
    const pct = choice =>`), ctx);
  data.set('aduventure_save', JSON.stringify({
    v: 1, sceneKey, flags: [], ruleKey: 'srd20', fate: 0, specialLeft: 2, breathLeft: 1, tutSeen: true,
    pc: {...vm.runInContext('CLASSES.fighter', ctx), classKey: 'fighter', name: 'QA'}, stats: {rolls: 0, success: 0}
  }));
  const render = () => { index = 0; return vm.runInContext('CRPG()', ctx); };
  nodes(render()).find(n => n.props.className === 'continueBtn').props.onClick();
  const flush = () => { for (let k = 0; k < 20; k++) intervals.forEach(fn => fn && fn()); };
  const pick = (label, ok) => {
    luck = ok ? 0.999 : 0;
    nodes(byClass(render(), 'choices')[0]).find(n => n.type === 'button' && text(n).startsWith(label)).props.onClick();
    flush();
    return render();
  };
  return {render, data, pick, run: c => vm.runInContext(c, ctx), scars: () => JSON.parse(data.get('aduventure_scars') || '{}'), api: () => { render(); return ctx.api; }};
}
const pctOf = (tree, label) => Number(text(nodes(byClass(tree, 'choices')[0]).find(n => n.type === 'button' && text(n).startsWith(label))).match(/(\d+)%/)[1]);

test('a failed check leaves a scar, says so, and does not help in the same record', () => {
  const g = game();
  const before = pctOf(g.render(), 'Search the darkness');
  const tree = g.pick('Search the darkness', false);
  assert.deepEqual(g.scars(), {perception: {n: 1, at: 'door'}});
  assert.equal(text(byClass(tree, 'scarNote')[0]), '🩹 A scar remains — Perception ●○. From your next record, Perception checks get 1 easier.');
  g.api().goto('door');
  assert.equal(pctOf(g.render(), 'Search the darkness'), before, 'Scars count from the next record');
});

test('a success leaves no scar', () => {
  const g = game();
  g.pick('Search the darkness', true);
  assert.deepEqual(g.scars(), {});
});

test('one scar per skill per record, and never deeper than two', () => {
  const g = game();
  g.pick('Search the darkness', false);
  g.api().goto('door');
  g.pick('Search the darkness', false);
  assert.equal(g.scars().perception.n, 1, 'Only one per record');
  const run = game().run;
  let s = {};
  for (let i = 0; i < 5; i++) s = JSON.parse(JSON.stringify(run(`addScar(${JSON.stringify(s)}, 'stealth', 'door')`)));
  assert.equal(s.stealth.n, 2);
});

test('the next record: the scarred skill shows its scar and is 5% per scar easier on a d20', () => {
  const plain = pctOf(game().render(), 'Search the darkness');
  const tree = game({scars: {perception: {n: 2, at: 'door'}}}).render();
  assert.equal(pctOf(tree, 'Search the darkness'), plain + 10);
  const btn = nodes(byClass(tree, 'choices')[0]).find(n => n.type === 'button' && text(n).startsWith('Search the darkness'));
  assert.match(text(btn), /scar ●●/);
  const other = nodes(byClass(tree, 'choices')[0]).find(n => n.type === 'button' && text(n).includes('Athletics'));
  assert.doesNotMatch(text(other), /scar/);
});

test('scar text is bilingual', () => {
  const g = game();
  for (const k of ['scarTag', 'scarNew', 'scarMaxed', 'scarH', 'scarNone', 'scarLine']) {
    const s = g.run(`UI.${k}`);
    assert.ok(s.ko && s.en, k);
    assert.equal(HANGUL.test(s.en), false, s.en);
  }
});
