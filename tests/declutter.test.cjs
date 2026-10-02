// pt23 — 덜어내기: 기본 화면은 꼬리표 하나·숫자 숨김, 장치는 회차마다 하나씩 드러난다.
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
const isTag = n => typeof n.props.className === 'string' && /^(tag|stake)\b/.test(n.props.className);

function game({sceneKey = 'scully1', flags = [], runNo = 140, store = {}, classKey = 'wizard', luck = 0.999} = {}) {
  const states = [], intervals = [];
  let index = 0;
  const data = new Map([['aduventure_lang', JSON.stringify('en')], ...Object.entries(store).map(([k, v]) => [k, JSON.stringify(v)])]);
  const ctx = vm.createContext({
    console, Date, Math: Object.assign(Object.create(Math), {random: () => luck}),
    setTimeout: () => 0, clearTimeout() {}, setInterval: fn => intervals.push(fn) - 1, clearInterval: id => intervals[id] = null,
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
    globalThis.api = {setNotes, sceneKey};
    const pct = choice =>`), ctx);
  data.set('aduventure_save', JSON.stringify({
    v: 1, sceneKey, flags, ruleKey: 'srd20', fate: 0, specialLeft: 2, breathLeft: 1, tutSeen: true, runNo,
    pc: {...vm.runInContext(`CLASSES.${classKey}`, ctx), classKey, name: 'QA'}, stats: {rolls: 0, success: 0}
  }));
  const render = () => { index = 0; return vm.runInContext('CRPG()', ctx); };
  nodes(render()).find(n => n.props.className === 'continueBtn').props.onClick();
  const choices = () => nodes(byClass(render(), 'choices')[0]).filter(n => n.type === 'button');
  const flush = () => { for (let k = 0; k < 20; k++) intervals.forEach(fn => fn && fn()); };
  return {render, choices, data, flush, run: c => vm.runInContext(c, ctx), api: () => { render(); return ctx.api; }};
}
const busy = {flags: ['leadOil'], store: {aduventure_seen: ['scully1'], aduventure_taken: ['scully1:0'], aduventure_scars: {perception: {n: 1, at: 'door'}}}};

test('by default a choice carries one tag and no percentages', () => {
  const g = game(busy);
  const buttons = g.choices();
  assert.ok(buttons.length >= 5);
  for (const b of buttons) {
    assert.ok(nodes(b).filter(isTag).length <= 1, text(b));
    assert.doesNotMatch(text(b), /\d+%/);
  }
  const tags = buttons.flatMap(b => nodes(b).filter(isTag));
  assert.ok(tags.length <= buttons.length, 'At most one tag per choice (it was ~20 on this screen)');
  assert.ok(buttons.some(b => /easy|even odds|hard/.test(text(b))), 'Odds become a word');
  assert.ok(buttons.some(b => text(b).includes('🦋 At stake · Take the upper hand')), 'A clue road shows the butterfly and what it buys');
});

test('consequence choices still show what is at stake; dice choices do not', () => {
  const rail = game({sceneKey: 'railing', classKey: 'fighter'}).choices();
  assert.equal(rail.filter(b => byClass(b, 'stake').length).length, 2, 'The two plain choices keep their stakes');
  assert.equal(byClass(rail.find(b => text(b).includes('hold on to both')), 'stake').length, 0);
});

test('the numbers switch brings every detail back, remembers itself, and owns the rules menu', () => {
  const g = game(busy);
  let tree = g.render();
  assert.equal(nodes(tree).filter(n => n.type === 'select').length, 0, 'No rules menu by default');
  assert.equal(nodes(byClass(tree, 'sheet')[0]).some(n => /^AC /.test(text(n))), false, 'No AC by default');
  nodes(tree).find(n => n.props['aria-label'] === 'numbers').props.onClick();
  tree = g.render();
  assert.equal(g.data.get('aduventure_numbers'), 'true');
  assert.equal(nodes(tree).filter(n => n.type === 'select').length, 1);
  assert.ok(text(byClass(tree, 'sheet')[0]).includes('AC 12'));
  assert.ok(g.choices().some(b => /\d+%/.test(text(b))));
  assert.ok(g.choices().flatMap(b => nodes(b).filter(isTag)).length > g.choices().length);
});

test('features unlock one record at a time', () => {
  const first = game({...busy, runNo: 113});
  assert.equal(first.choices().some(b => /road not taken|past record/.test(text(b))), false, 'No footprints on the first record');
  const second = game({...busy, runNo: 114});
  assert.ok(second.choices().some(b => /road not taken|past record/.test(text(b))));
  const intro = text(game({sceneKey: 'intro', runNo: 114}).render());
  assert.ok(intro.includes('From this record on — footprints.'));
  assert.ok(text(game({sceneKey: 'intro', runNo: 115}).render()).includes('From this record on — scars.'));
  assert.ok(text(game({sceneKey: 'intro', runNo: 116}).render()).includes('From this record on — red notes.'));
  assert.equal(text(game({sceneKey: 'intro', runNo: 120}).render()).includes('From this record on'), false);
});

test('scars start on the third record, red notes on the fourth', () => {
  for (const [no, expect] of [[114, false], [115, true]]) {
    const g = game({sceneKey: 'door', runNo: no, classKey: 'fighter', luck: 0});
    nodes(byClass(g.render(), 'choices')[0]).find(n => n.type === 'button' && text(n).startsWith('Search the darkness')).props.onClick();
    g.flush();
    assert.equal(!!g.data.get('aduventure_scars'), expect, 'record ' + no);
  }
  for (const [no, expect] of [[115, 0], [116, 1]]) {
    const g = game({sceneKey: 'top', runNo: no});
    g.api().setNotes({top: [{scene: 'top', s: 'ren', v: 'doubt', r: 'gear', no: 120}]});
    assert.equal(byClass(g.render(), 'noteCard').length, expect, 'record ' + no);
  }
});

test('the shelf line is the loudest thing on its screen', () => {
  const tree = game({sceneKey: 'c2_hall', runNo: 131}).render();
  assert.equal(text(byClass(tree, 'bigLine')[0]), 'No. 113 through No. 131. Every one of them, a record you rewrote.');
});

test('new words are bilingual', () => {
  const g = game();
  for (const k of ['diffEasy', 'diffEven', 'diffHard', 'numbersOn', 'numbersOff']) assert.equal(HANGUL.test(g.run(`UI.${k}.en`)), false);
  for (const k of [1, 2, 3]) { const l = g.run(`UNLOCK_LINES[${k}]`); assert.ok(l.ko && l.en); assert.equal(HANGUL.test(l.en), false); }
});
