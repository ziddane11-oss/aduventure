// pt30 — 사건판 추론: 누가·무엇을·왜. 셋 다 맞아야 확정, 한 판에 한 번, 맞은 칸 수만 알려 준다. 확정되면 조각이 모자라도 판결.
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

function game({sceneKey = 'ending', flags = [], lore = [], lang = 'en', deduce, runNo = 130} = {}) {
  const states = [];
  let index = 0;
  const data = new Map([['aduventure_lang', JSON.stringify(lang)], ['aduventure_lore', JSON.stringify(lore)]]);
  if (deduce) data.set('aduventure_deduce', JSON.stringify(deduce));
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
    globalThis.api = {sceneKey, flags, setCaseOpen};
    const pct = choice =>`), ctx);
  data.set('aduventure_save', JSON.stringify({
    v: 1, sceneKey, flags, ruleKey: 'srd20', fate: 1, specialLeft: 2, breathLeft: 1, tutSeen: true, runNo,
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

function board(g) { g.state().setCaseOpen(true); return nodes(g.render()).find(n => typeof n.props.className === 'string' && n.props.className.startsWith('deduce')); }
function pick(g, who, what, why) {
  const sel = nodes(board(g)).filter(n => n.type === 'select');
  sel[0].props.onChange({target: {value: who}}); sel[1].props.onChange({target: {value: what}}); sel[2].props.onChange({target: {value: why}});
  nodes(board(g)).find(n => n.type === 'button' && /Check the deduction/.test(text(n))).props.onClick();
}

test('the deduction opens after two fragments and tells only how many of three are right', () => {
  assert.match(text(board(game({sceneKey: 'intro', lore: ['f_receipt']}))), /Gather two or more fragments/);
  const g = game({sceneKey: 'intro', lore: ['f_receipt', 'f_window']});
  pick(g, 'seon', 'sell', 'ship');
  assert.match(text(board(g)), /2 of three are right\. The record won't say which/);
  assert.match(text(board(g)), /You already checked in this chapter/);
  assert.equal(nodes(board(g)).find(n => n.type === 'button' && /Check the deduction/.test(text(n))), undefined, 'once per record');
  assert.equal(JSON.parse(g.data.get('aduventure_deduce')).solved, false);
});

test('next record you may check again; all three right confirms it for good', () => {
  const g = game({sceneKey: 'intro', lore: ['f_receipt', 'f_window'], deduce: {tried: [130], last: {n: 2}}, runNo: 131});
  pick(g, 'seon', 'dark', 'ship');
  assert.match(text(board(g)), /Deduction confirmed/);
  assert.equal(JSON.parse(g.data.get('aduventure_deduce')).solved, true);
});

test('a confirmed deduction opens the verdict even with fragments missing', () => {
  const g = game({sceneKey: 'ending3', lore: ['f_receipt', 'f_window'], deduce: {solved: true}});
  const primary = nodes(g.render()).filter(n => n.type === 'button' && n.props.className === 'restart primary');
  assert.ok(primary.some(b => /reach a verdict/.test(text(b))), primary.map(text).join(' | '));
  const no = game({sceneKey: 'ending3', lore: ['f_receipt', 'f_window']});
  assert.ok(!nodes(no.render()).some(n => n.type === 'button' && /reach a verdict/.test(text(n))));
});

test('replaying a chapter is a new run: the deduction may be checked again', () => {
  const g = game({sceneKey: 'ending2', lore: ['f_receipt', 'f_window']});
  pick(g, 'seon', 'sell', 'ship');
  assert.match(text(board(g)), /You already checked in this chapter/);
  g.state().setCaseOpen(false);
  nodes(g.render()).find(n => n.type === 'button' && /Replay Ch\.2/.test(text(n))).props.onClick();
  assert.ok(nodes(board(g)).some(n => n.type === 'button' && /Check the deduction/.test(text(n))), 'a fresh chance after replaying the chapter');
});

test('the answer is the story: Seon ordered the light out to bring the ship in; every option is bilingual', () => {
  const g = game();
  assert.equal(g.run('deduceScore(DEDUCE.answer)'), 3);
  assert.equal(g.run('deduceScore({who: "bern", what: "dark", why: "ship"})'), 2);
  assert.equal(g.run('"botch" in DEDUCE.what || "accident" in DEDUCE.why'), false, 'no decoy the narration once states as fact');
  assert.match(g.run('UI.deduceWho.en'), /ordered/);
  const all = JSON.parse(g.run('JSON.stringify(["who","what","why"].flatMap(k => Object.values(DEDUCE[k])))'));
  assert.equal(all.length, 12);
  for (const t of all) assert.ok(HANGUL.test(t.ko) && t.en && !HANGUL.test(t.en), JSON.stringify(t));
  for (const k of ['deduceH', 'deduceCheck', 'deduceScore', 'deduceSolved', 'deduceLocked', 'deduceWait']) {
    const t = JSON.parse(g.run(`JSON.stringify(UI.${k})`)); assert.ok(HANGUL.test(t.ko) && !HANGUL.test(t.en), k);
  }
});
