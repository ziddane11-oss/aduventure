// pt22 — 사건 2 「붉은 손글씨」 1장: 판결 뒤에 열리고, 먹울 필사소에서 '붉은 손은 한 사람이 아니다'를 알게 된다.
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

function game({sceneKey = 'intro', flags = [], verdict = null, classKey = 'fighter', runNo = 130} = {}) {
  const states = [];
  let index = 0;
  const data = new Map([['aduventure_lang', JSON.stringify('en')]]);
  if (verdict) data.set('aduventure_verdict', JSON.stringify(verdict));
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
    globalThis.api = {sceneKey, flags};
    const pct = choice =>`), ctx);
  data.set('aduventure_save', JSON.stringify({
    v: 1, sceneKey, flags, ruleKey: 'srd20', fate: 1, specialLeft: 2, breathLeft: 1, tutSeen: true, runNo,
    pc: {...vm.runInContext(`CLASSES.${classKey}`, ctx), classKey, name: 'QA'}, stats: {rolls: 0, success: 0}
  }));
  const render = () => { index = 0; return vm.runInContext('CRPG()', ctx); };
  nodes(render()).find(n => n.props.className === 'continueBtn').props.onClick();
  const buttons = () => nodes(render()).filter(n => n.type === 'button');
  return {render, buttons, run: c => vm.runInContext(c, ctx), state: () => { render(); return ctx.api; }};
}
const g0 = game();
const C2 = ['c2_intro', 'c2_gate', 'c2_duel', 'c2_hall', 'c2_reader'];

test('after the verdict, the epilogue leads on to Case 2', () => {
  const g = game({sceneKey: 'ending4', flags: ['accuseSeon']});
  const go = g.buttons().find(b => text(b) === 'On to Case 2, "The Red Hand" →');
  assert.ok(go);
  go.props.onClick();
  assert.equal(g.state().sceneKey, 'c2_intro');
});

test('a later record can start straight from Case 2, carrying the verdict', () => {
  assert.equal(game().buttons().some(b => text(b).includes('Case 2')), false, 'Not before any verdict');
  const g = game({verdict: {kind: 'accuseBern', name: 'QA', no: 120}});
  g.buttons().find(b => text(b).includes('Start from Case 2')).props.onClick();
  const s = g.state();
  assert.equal(s.sceneKey, 'c2_intro');
  assert.deepEqual([...s.flags], ['accuseBern']);
  assert.ok(text(g.render()).includes("Bern's old shipmate brought the envelope"), 'The verdict decides who sends the letter');
});

test('every Case 2 path ends the chapter; each class has its own road at the gate', () => {
  const scenes = g0.run('SCENES');
  const ends = new Set();
  for (const k of C2) for (const c of scenes[k].choices) for (const b of [c.success, c.fail, c.result, c.goto ? {goto: c.goto} : null].filter(Boolean)) {
    ends.add(b.goto);
    assert.ok(C2.includes(b.goto) || b.goto === 'c2_end', k + ' -> ' + b.goto);
    if (b.damage) assert.equal(b.ifDown, 'gameover');
  }
  assert.ok(ends.has('c2_end'));
  for (const cls of ['fighter', 'rogue', 'wizard']) assert.ok(scenes.c2_gate.choices.some(c => c.classOnly === cls && c.stake), cls);
  assert.equal(g0.run('SCENES.c2_end.ending'), 5);
  assert.equal(g0.run('SCENES.c2_intro.ch'), 5);
});

test('the endless shelves show the records you rewrote', () => {
  const tree = game({sceneKey: 'c2_hall', runNo: 131}).render();
  assert.match(text(byClass(tree, 'hallExtra')[0]), /^No\. 113 through No\. 131\. Every one of them, a record you rewrote\./);
});

test('the chapter ending, record, ledger and badge exist and say the red hand is many', () => {
  const g = game();
  const end = g.run(`buildEnding5(['c2_many','c2_erased','c2_ownCopy']).en`);
  assert.match(end, /The red hand is not one person/);
  assert.match(end, /Re-copy with red rebuttals removed/);
  const rec = JSON.parse(JSON.stringify(g.run(`officialRecord(5, ['c2_ownCopy'], 131)`)));
  assert.equal(rec.rebut.en, "My rebuttal is right here. You couldn't erase it.");
  assert.equal(g.run(`chapterLedger(5, ['c2_ownCopy']).length`), 3);
  assert.equal(g.run(`badgeId(5, [])`), '5');
  const t = text(game({sceneKey: 'c2_end'}).render());
  assert.ok(t.includes('Case 2 continues in a future update.'));
});

test('all Case 2 text is bilingual', () => {
  const out = g0.run(`(() => {
    const o = [];
    for (const k of ${JSON.stringify(C2)}) {
      o.push(SCENES[k].text, SCENE_TITLES[k], SCENE_DOING[k]);
      for (const c of SCENES[k].choices) o.push(c.label, c.stake, c.success && c.success.text, c.fail && c.fail.text, c.result && c.result.text);
    }
    for (const e of ECHOES.c2_intro) o.push(e.text);
    o.push(buildEnding5(['c2_erased','c2_straight','c2_ownCopy']), CAST.ire.name, CAST.ire.role, ...['c2ch1','c2Go','c2Skip','c2More','c2Hall','c2Notes'].map(k => UI[k]));
    for (const f of [[], ['c2_ownCopy']]) { const r = officialRecord(5, f, 131); o.push(r.head, ...r.lines, r.signer, r.rebut); }
    for (const r of chapterLedger(5, ['c2_erased','c2_ownCopy','c2_tip'])) o.push(r.text);
    return o.filter(Boolean);
  })()`);
  assert.ok(out.length > 50);
  for (const t of out) {
    assert.ok(t.ko && t.en, JSON.stringify(t));
    assert.equal(HANGUL.test(t.en), false, t.en);
  }
});
