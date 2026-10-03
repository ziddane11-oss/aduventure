// pt14 — 첫 화면의 '틀린 공식 기록', 회차 = 기록 번호, 장마다 공식 기록과 반박, 공유용 기록.
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
// 테스트용 React는 컴포넌트를 실행하지 않으므로 RecordCard를 직접 펼친다.
const recordCard = tree => {
  const el = nodes(tree).find(n => typeof n.type === 'function' && n.type.name === 'RecordCard');
  return el ? el.type({...el.props, children: el.children}) : null;
};

function fresh({lang = 'en', store = {}} = {}) {
  const states = [];
  let index = 0;
  const data = new Map([['aduventure_lang', JSON.stringify(lang)], ...Object.entries(store).map(([k, v]) => [k, JSON.stringify(v)])]);
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
    globalThis.api = {goto, restart, flags, sceneKey, runNo, pc};
    const pct = choice =>`), ctx);
  const render = () => { index = 0; return vm.runInContext('CRPG()', ctx); };
  return {render, data, run: code => vm.runInContext(code, ctx), state: () => { render(); return ctx.api; }};
}

for (const lang of ['ko', 'en']) {
  test(`${lang}: the first screen is a wrong official record and a choice, before any menus`, () => {
    const g = fresh({lang});
    const tree = g.render();
    const card = recordCard(tree);
    assert.ok(card, 'Record card shown first');
    const t = text(card);
    assert.ok(t.includes(lang === 'en' ? 'Record · No. 113' : '제113호'));
    assert.ok(t.includes(lang === 'en' ? 'The name was not recorded' : '이름은 기록되지 않았다'));
    assert.equal(text(byClass(card, 'redhand')[0]), lang === 'en' ? 'This is a lie.' : '거짓말이다.');
    assert.equal(byClass(tree, 'card').length, 0, 'No class cards yet');
    const buttons = nodes(tree).filter(n => n.type === 'button' && /choice/.test(n.props.className || ''));
    assert.deepEqual(buttons.map(text), [g.run(`UI.recordLie.${lang}`), g.run(`UI.recordBelieve.${lang}`)]);
    if (lang === 'en') assert.equal(HANGUL.test(text(card)), false);
  });
}

for (const [pick, expected] of [['choice primaryChoice', []], ['choice', ['believed']]]) {
  test(`opening "${pick}" leads to naming the record and numbers the run`, () => {
    const g = fresh();
    byClass(g.render(), pick)[0].props.onClick();
    const tree = g.render();
    assert.ok(text(tree).includes('What name goes on the record?'));
    assert.ok(nodes(tree).some(n => n.type === 'details' && n.props.className === 'archive'), 'Collections are folded away');
    byClass(tree, 'card')[0].props.onClick();
    const s = g.state();
    assert.equal(s.runNo, 113);
    assert.equal(g.data.get('aduventure_record_no'), '114');
    assert.deepEqual([...s.flags], expected);
    assert.ok(text(g.render()).includes('Record No. 113'), 'Chapter banner names the record');
  });
}

test('the next run shows a new record number and what you did last time', () => {
  const g = fresh({store: {aduventure_record_no: 115, aduventure_lastrun: {no: 114, died: false, keys: ['caughtRen', 'saved3']}}});
  const tree = g.render();
  assert.ok(text(recordCard(tree)).includes('No. 115'));
  assert.equal(text(byClass(tree, 'lastRun')[0]), 'In Record No. 114, you saved the courier over the evidence. And this time?');
});

test('dying makes the record come true, and offers to rewrite it', () => {
  const g = fresh();
  byClass(g.render(), 'choice primaryChoice')[0].props.onClick();
  byClass(g.render(), 'card')[0].props.onClick();
  g.state().goto('gameover');
  const tree = g.render();
  const card = recordCard(tree);
  assert.ok(text(card).includes('It went as recorded'));
  const again = nodes(tree).find(n => n.type === 'button' && text(n) === 'Rewrite this record');
  again.props.onClick();
  assert.ok(recordCard(g.render()), 'Back to the record screen');
  assert.equal(byClass(g.render(), 'card').length, 0);
});

test('summaries name the most decisive thing you did', () => {
  const g = fresh();
  const line = (keys, died = false) => g.run(`lastRunLine(${JSON.stringify({no: 120, died, keys})})?.en ?? null`);
  assert.equal(line(['accuseSeon', 'saved3']), 'In Record No. 120, you accused Seon. And this time?');
  assert.equal(line(['keptLens'], true), 'In Record No. 120, you died, just as recorded. And this time?');
  assert.equal(line([]), null);
  assert.deepEqual([...g.run(`runSummary(['caughtRen','sabotage','f_receipt','believed'], 130).keys`)], ['caughtRen', 'believed']);
});

test('each chapter ending files an official record, and a red-ink rebuttal only when you know better', () => {
  const g = fresh();
  const rec = (k, f) => g.run(`officialRecord(${JSON.stringify(k)}, ${JSON.stringify(f)}, 113)`);
  assert.equal(rec(1, []).rebut, null);
  assert.match(rec(1, ['sabotage']).rebut.en, /pulled that gear/);
  assert.match(rec(1, ['sabotage', 'believed']).rebut.ko, /^처음에 당신은 이 기록을 믿었다/);
  assert.match(rec(1, ['signal']).lines[0].en, /lens stolen/);
  assert.equal(rec(2, []).rebut, null);
  assert.match(rec(2, ['f_fund']).rebut.en, /Common Fund/);
  assert.match(rec(3, ['f_hand_match']).rebut.en, /key tag/);
  assert.equal(rec(4, ['accuseSeon']).signer.en, 'Recorded by: {name}');
  assert.match(rec(4, ['accuseBern']).rebut.en, /let it stand/);
  assert.equal(rec(4, ['dealSeon']).stamp.en, 'Co-signed');
});

test('the shareable record is plain text with the rebuttal and the game link, in one language', () => {
  const g = fresh();
  const out = g.run(`recordShareText(officialRecord(1, ['sabotage'], 113), {name: 'QA'}, 'en')`);
  assert.match(out, /^\[Saltmarsh Official Record · No\. 113\]/);
  assert.match(out, /In red ink: Not bad luck/);
  assert.match(out, /https:\/\/ziddane11-oss\.github\.io\/aduventure\//);
  assert.equal(HANGUL.test(out), false);
});

test('all record text is bilingual', () => {
  const g = fresh();
  const strings = g.run(`(() => {
    const out = [];
    const walk = v => {
      if (!v || typeof v !== 'object') return;
      if (typeof v.ko === 'string' && 'en' in v) { out.push(v); return; }
      Object.values(v).forEach(walk);
    };
    const combos = [[], ['sabotage'], ['sabotage','believed'], ['signal','sabotage'], ['peaceful2'], ['f_fund'], ['f_addressee'], ['f_hand_match'], ['accuseSeon'], ['accuseBern'], ['dealSeon']];
    for (const k of ['opening', 'gameover', 1, 2, 3, 4]) for (const f of combos) walk(officialRecord(k, f, 113));
    for (const keys of [['accuseSeon'], ['accuseBern'], ['dealSeon'], ['saved3'], ['chase3'], ['caughtRen'], ['keptLens'], ['signal'], ['peaceful']]) walk(lastRunLine({no: 1, died: false, keys}));
    walk(['recordLie','recordBelieve','nameRecord','rewrite','archive','recNo','caseSub','shareRec','shareDone','shareFail'].map(k => UI[k]));
    return out;
  })()`);
  assert.ok(strings.length > 60);
  for (const s of strings) {
    if (s.ko === '' && s.en === '') continue;
    assert.ok(s.ko && s.en, JSON.stringify(s));
    assert.equal(HANGUL.test(s.en), false, s.en);
  }
});
