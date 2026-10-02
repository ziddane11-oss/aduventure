// pt27 — 기록 반박("이의 있음"): 거짓 줄을 짚고 증거를 내민다. 한 번의 기회, 이기면 붉은 줄 + 다음 장 운명 +1.
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

function game({sceneKey = 'ending', flags = [], lore = []} = {}) {
  const states = [];
  let index = 0;
  const data = new Map([['aduventure_lang', JSON.stringify('en')], ['aduventure_lore', JSON.stringify(lore)]]);
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
  const panel = () => expand(render(), 'ObjectionPanel');
  const card = () => { const el = nodes(render()).find(n => typeof n.type === 'function' && n.type.name === 'RecordCard'); return el.props.record; };
  const press = (cls, pick = 0) => nodes(panel()).filter(n => n.type === 'button' && n.props.className === cls)[pick].props.onClick();
  return {render, panel, card, press, run: c => vm.runInContext(c, ctx), state: () => { render(); return ctx.api; }};
}

test('the official record no longer rebuts itself; the red line must be won', () => {
  const g = game({flags: ['sabotage']});
  assert.equal(g.card().rebut, null);
  assert.match(text(g.panel()), /Objection — point at the lie/);
});

test('pointing at a true line seals the record, with one chance only', () => {
  const g = game({flags: ['sabotage']});
  g.press('choice objStart');
  assert.match(text(g.panel()), /Which line is the lie\?/);
  g.press('choice objLine', 0);
  assert.ok(g.state().flags.includes('rebutX1'));
  assert.match(text(g.panel()), /That line is true/);
  assert.equal(g.card().stamp.en, 'Sealed');
  assert.equal(g.card().rebut, null);
});

test('the right line and the right evidence strike the lie in red, and the next chapter starts with two fate dice', () => {
  const g = game({flags: ['sabotage', 'trail']});
  g.press('choice objStart');
  g.press('choice objLine', 1);
  const ev = nodes(g.panel()).filter(n => n.props.className === 'choice objEvidence').map(text);
  assert.ok(ev.some(t => t.includes('The gear pulled out on purpose')));
  assert.ok(ev.some(t => t.includes('Footprints leading underground')), 'Only what you hold, decoys included');
  g.press('choice objEvidence', ev.findIndex(t => t.includes('gear')));
  assert.ok(g.state().flags.includes('rebut1'));
  assert.match(text(g.panel()), /Red ink strikes the line — 'The gear pulled out on purpose'/);
  assert.equal(g.card().struck, 1);
  assert.equal(g.card().stamp.en, 'Corrected');
  assert.match(g.card().rebut.en, /pulled that gear/);
  g.state().goto('intro2');
  assert.equal(g.state().fate, 2);
});

test('the wrong evidence seals it too', () => {
  const g = game({flags: ['sabotage', 'trail']});
  g.press('choice objStart');
  g.press('choice objLine', 1);
  const ev = nodes(g.panel()).filter(n => n.props.className === 'choice objEvidence').map(text);
  g.press('choice objEvidence', ev.findIndex(t => t.includes('Footprints')));
  assert.ok(g.state().flags.includes('rebutX1'));
  assert.match(text(g.panel()), /doesn't overturn this line/);
});

test('fragments from earlier records count as evidence; with nothing in hand you can only back down', () => {
  const g = game({sceneKey: 'ending2', lore: ['f_fund']});
  g.press('choice objStart');
  g.press('choice objLine', 1);
  assert.ok(nodes(g.panel()).some(n => n.props.className === 'choice objEvidence' && text(n).includes('The smuggling ledger')));
  const empty = game({sceneKey: 'ending3'});
  empty.press('choice objStart');
  empty.press('choice objLine', 1);
  assert.match(text(empty.panel()), /You have nothing to lay down/);
});

test('every chapter has a lie and enough possible proof, and the words are bilingual', () => {
  const g = game();
  for (const ch of [1, 2, 3]) {
    const r = g.run(`REBUTTALS[${ch}]`);
    assert.ok(r.proof.length >= 4);
    for (const id of r.proof) assert.ok(g.run(`!!EVIDENCE[${JSON.stringify(id)}]`), id);
    const lines = g.run(`officialRecord(${ch}, [], 130).lines`);
    assert.ok(r.line < lines.length);
  }
  for (const k of ['objH', 'objStart', 'objPickLine', 'objPickEvidence', 'objNoEvidence', 'objWithdraw', 'objWon', 'objWrongLine', 'objWrongEvidence', 'objStamp', 'objSealed']) assert.equal(HANGUL.test(g.run(`UI.${k}.en`)), false, k);
  for (const e of g.run('Object.values(EVIDENCE)')) assert.equal(HANGUL.test(e.name.en), false);
});
