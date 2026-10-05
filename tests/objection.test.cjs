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
  assert.match(text(g.panel()), /Objection — overturn the lie with evidence/);
});

// pt38: 거짓 문장 고르기 단계는 없앴다(사람 플레이테스트: "뭘 해야 할지 모르겠다"). 시작하면 바로 그 문장과 증거 고르기.
test('starting an objection goes straight to the false sentence and the evidence, with the goal spelled out', () => {
  const g = game({flags: ['sabotage', 'trail']});
  assert.match(text(g.panel()), /Overturn one false sentence in the official record with one piece of evidence/);
  g.press('choice objStart');
  const panel = text(g.panel());
  assert.match(panel, /“Cause: mechanism failure — bad luck\.”/, 'the lie is quoted at once');
  assert.match(panel, /Pick the evidence that proves this sentence wrong\. \(You may miss once\.\)/);
  assert.ok(!nodes(g.panel()).some(n => n.props.className === 'choice objLine'), 'no line-picking step');
});

test('with no evidence that could overturn it, the objection is locked and says what would do', () => {
  const g = game({flags: ['trail']});
  const btn = nodes(g.panel()).find(n => n.props.className === 'choice objStart');
  assert.ok(btn.props.disabled);
  assert.match(text(g.panel()), /No evidence to overturn it yet\. Any one of these would do: The gear pulled out on purpose · Ren's testimony/);
  assert.match(g.run('UI.objNeed.ko'), /아직 뒤집을 증거가 없다/);
});

test('the right line and the right evidence strike the lie in red, and the next chapter starts with two fate dice', () => {
  const g = game({flags: ['sabotage', 'trail']});
  g.press('choice objStart');
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

test('a wrong piece of evidence gets one more try; the second miss seals it', () => {
  const g = game({flags: ['sabotage', 'trail', 'keeper']});
  g.press('choice objStart');
  const panel = text(g.panel());
  assert.match(panel, /“Cause: mechanism failure — bad luck\.”/, 'the lie being rebutted is quoted');
  assert.match(panel, /Not a breakdown — someone tampered with it/, 'each piece says what it shows');
  const pick = name => { const ev = nodes(g.panel()).filter(n => n.props.className === 'choice objEvidence').map(text); g.press('choice objEvidence', ev.findIndex(t => t.includes(name))); };
  pick('Footprints');
  assert.equal(g.state().flags.includes('rebutX1'), false, 'not sealed on the first miss');
  assert.match(text(g.panel()), /try once more/);
  assert.ok(!text(g.panel()).includes('Footprints'), 'the tried piece is set aside');
  pick('bell-keeper');
  assert.ok(g.state().flags.includes('rebutX1'));
  assert.match(text(g.panel()), /doesn't overturn this line/);
});

test('after one miss, the right piece still wins', () => {
  const g = game({flags: ['sabotage', 'trail']});
  g.press('choice objStart');
  const ev = () => nodes(g.panel()).filter(n => n.props.className === 'choice objEvidence').map(text);
  g.press('choice objEvidence', ev().findIndex(t => t.includes('Footprints')));
  g.press('choice objEvidence', ev().findIndex(t => t.includes('gear')));
  assert.ok(g.state().flags.includes('rebut1'));
});

test('every piece of evidence says what it shows, in both languages', () => {
  const g = game();
  for (const e of JSON.parse(g.run('JSON.stringify(Object.values(EVIDENCE).map(e => e.shows))'))) {
    assert.ok(HANGUL.test(e.ko) && e.en && !HANGUL.test(e.en));
  }
});

test('fragments from earlier records count as evidence; with nothing in hand you can only back down', () => {
  const g = game({sceneKey: 'ending2', lore: ['f_fund']});
  g.press('choice objStart');
  g.press('choice objLine', 1);
  assert.ok(nodes(g.panel()).some(n => n.props.className === 'choice objEvidence' && text(n).includes('The smuggling ledger')));
  const empty = game({sceneKey: 'ending3'});
  assert.ok(nodes(empty.panel()).find(n => n.props.className === 'choice objStart').props.disabled, 'nothing in hand: locked, not a trap');
});

test('every chapter has a lie and enough possible proof, and the words are bilingual', () => {
  const g = game();
  for (const ch of [1, 2, 3]) {
    const r = g.run(`REBUTTALS[${ch}]`);
    assert.ok(r.proof.length >= 2, 'more than one route can supply relevant evidence');
    for (const id of r.proof) assert.ok(g.run(`!!EVIDENCE[${JSON.stringify(id)}]`), id);
    const lines = g.run(`officialRecord(${ch}, [], 130).lines`);
    assert.ok(r.line < lines.length);
  }
  for (const k of ['objH', 'objStart', 'objHow', 'objNeed', 'objPickLine', 'objPickEvidence', 'objNoEvidence', 'objWithdraw', 'objWon', 'objWrongLine', 'objWrongEvidence', 'objStamp', 'objSealed']) assert.equal(HANGUL.test(g.run(`UI.${k}.en`)), false, k);
  for (const e of g.run('Object.values(EVIDENCE)')) assert.equal(HANGUL.test(e.name.en), false);
});

test('replaying a chapter clears the last objection, so it can be raised again', () => {
  const g = game({sceneKey: 'ending2', flags: ['ledger']});
  g.press('choice objStart');
  g.press('choice objLine', 1);
  g.press('choice objEvidence', 0);
  assert.match(text(g.panel()), /Red ink strikes/);
  nodes(g.render()).find(n => n.type === 'button' && /Replay Ch\.2/.test(text(n))).props.onClick();
  g.state().goto('ending2');
  assert.equal(g.state().flags.includes('rebut2'), false);
  assert.match(text(g.panel()), /Objection — overturn the lie with evidence/, 'a fresh objection, not last run\'s result');
});

// pt29→pt32: 3장 끝 — 강조 버튼은 늘 '결론을 낸다'(첫 판에도). 진실에 필요한 것과 그걸 얻는 길은 아래에.
test('at the end of Ch.3 you can always reach a verdict; the road to the truth is listed below', () => {
  const noBern = game({sceneKey: 'ending3', lore: ['f_addressee', 'f_receipt', 'f_window', 'f_fund']});
  const btn = () => nodes(noBern.render()).filter(n => n.type === 'button' && /^restart/.test(n.props.className));
  const primary = btn().filter(b => b.props.className === 'restart primary');
  assert.equal(primary.length, 1);
  assert.match(text(primary[0]), /Reach a verdict with what you have/);
  assert.match(text(noBern.render()), /To accuse Seon \(the true ending\) you still need: Bern's statement \(Ch\.2, morning\)/);
  btn().find(b => /Back to Ch\.2 morning — ask Bern/.test(text(b))).props.onClick();
  assert.equal(noBern.state().sceneKey, 'intro2');
});

// pt31 — 1000명 인터뷰: 조각 3개 미만인데 「2장 아침으로 — 베른에게 묻는다」가 떠서 막다른 길로 보냈다.
test('with fewer than three fragments the ending does not send you to ask Bern; it says why', () => {
  const g = game({sceneKey: 'ending3', lore: ['f_addressee', 'f_receipt']});
  assert.ok(!nodes(g.render()).some(n => n.type === 'button' && /ask Bern/.test(text(n))));
  assert.match(text(g.render()), /To question Bern you need 3 fragments \(you have 2\)/);
  const primary = nodes(g.render()).filter(n => n.type === 'button' && n.props.className === 'restart primary');
  assert.equal(primary.length, 1);
  primary[0].props.onClick();
  assert.equal(g.state().sceneKey, 'accuse', 'even a first record can reach the verdict');
});

test('a wrong piece of evidence says why it fails', () => {
  const g = game({flags: ['sabotage', 'trail']});
  g.press('choice objStart');
  const ev = nodes(g.panel()).filter(n => n.props.className === 'choice objEvidence').map(text);
  g.press('choice objEvidence', ev.findIndex(t => t.includes('Footprints')));
  assert.match(text(g.panel()), /'Someone went down below' — that doesn't contradict this line/);
  const ko = JSON.parse(g.run('JSON.stringify([UI.objWhy, UI.caseBernLater, UI.caseMinNeed, UI.rewriteChapter, UI.rewriteAll, UI.nextStepH])'));
  for (const t of ko) assert.ok(/[가-힣]/.test(t.ko) && t.en && !/[가-힣]/.test(t.en));
});
