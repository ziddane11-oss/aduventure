// pt21 — 오판과 재심: 틀린 판결은 다음 기록에도 남고, 결정적 단서 둘을 모아 재심해야만 지워진다.
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

function game({verdict = null, lore = []} = {}) {
  const states = [];
  let index = 0;
  const data = new Map([['aduventure_lang', JSON.stringify('en')], ['aduventure_lore', JSON.stringify(lore)]]);
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
    v: 1, sceneKey: 'accuse', flags: [], ruleKey: 'srd20', fate: 1, specialLeft: 2, breathLeft: 1, tutSeen: true,
    pc: {...vm.runInContext('CLASSES.fighter', ctx), classKey: 'fighter', name: 'QA'}, stats: {rolls: 0, success: 0}
  }));
  const render = () => { index = 0; return vm.runInContext('CRPG()', ctx); };
  nodes(render()).find(n => n.props.className === 'continueBtn').props.onClick();
  const choices = () => nodes(byClass(render(), 'choices')[0]).filter(n => n.type === 'button');
  return {render, choices, run: c => vm.runInContext(c, ctx), api: () => { render(); return ctx.api; }};
}

test('a wrong verdict sticks; a right one replaces it only through a retrial', () => {
  const g = game();
  const nv = (prev, flags, no) => JSON.parse(JSON.stringify(g.run(`nextVerdict(${JSON.stringify(prev)}, ${JSON.stringify(flags)}, 'QA', ${no})`)));
  const bern = nv(null, ['accuseBern'], 120);
  assert.deepEqual(bern.wrong, {kind: 'accuseBern', no: 120, name: 'QA'});
  const deal = nv(bern, ['dealSeon'], 121);
  assert.equal(deal.wrong.no, 120, 'The first wrongful verdict is the one on record');
  const fixed = nv(deal, ['accuseSeon', 'retrial'], 122);
  assert.equal(fixed.wrong, undefined);
  assert.equal(fixed.overturned.no, 120);
  assert.equal(nv(null, ['accuseSeon'], 123).wrong, undefined);
});

test('without a wrongful verdict, the accuse scene is unchanged', () => {
  // pt32: [보류]는 늘 있고, [고발]은 증거가 모자라면 잠겨 보인다(첫 판에도 판결 장면엔 들어올 수 있다).
  const btns = game().choices();
  const labels = btns.map(text);
  assert.equal(labels.length, 4);
  assert.ok(labels[0].startsWith('[Accuse]'));
  assert.equal(btns[0].props.disabled, true, 'no proof yet: the true accusation is locked');
  assert.match(labels[0], /Not enough proof/);
  assert.ok(labels.some(l => l.startsWith('[Withdraw]')));
  assert.equal(labels.some(l => l.startsWith('[Retrial]')), false);
  const ready = game({lore: ['f_addressee', 'f_bern_lied', 'f_receipt', 'f_window']}).choices();
  assert.equal(ready[0].props.disabled, false, 'with the case ready, Seon can be accused');
});

test('after a wrongful verdict, plain accusation is gone and the retrial needs both decisive fragments', () => {
  const wrong = {kind: 'accuseBern', no: 120, name: 'QA', wrong: {kind: 'accuseBern', no: 120, name: 'QA'}};
  const half = game({verdict: wrong, lore: ['f_addressee']});
  let buttons = half.choices();
  assert.equal(buttons.some(b => text(b).startsWith('[Accuse]')), false);
  const retrial = buttons.find(b => text(b).startsWith('[Retrial]'));
  assert.equal(retrial.props.disabled, true);
  assert.match(text(retrial), /decisive fragments 1\/2/);
  retrial.props.onClick();
  assert.equal(half.api().sceneKey, 'accuse', 'A locked retrial does nothing');
  const withdraw = half.choices().find(b => text(b).startsWith('[Withdraw]'));
  assert.ok(withdraw, 'You are never forced into another wrongful verdict');
  withdraw.props.onClick();
  assert.equal(half.api().sceneKey, 'ending3');
  const board = half.run('wrongLine({kind: "accuseBern", no: 120}).en');
  assert.equal(board, 'Verdict No. 120 — lighthouse keeper Bern, imprisoned.');

  const full = game({verdict: wrong, lore: ['f_addressee', 'f_hand_match']});
  const open = full.choices().find(b => text(b).startsWith('[Retrial]'));
  assert.equal(open.props.disabled, false);
  open.props.onClick();
  const s = full.api();
  assert.equal(s.sceneKey, 'ending4');
  assert.deepEqual([...s.flags], ['accuseSeon', 'retrial']);
});

test('the opening record keeps the wrongful verdict until it is overturned', () => {
  const g = game();
  const rec = v => JSON.parse(JSON.stringify(g.run(`officialRecord('opening', [], 130, ${JSON.stringify(v)})`)));
  const bern = rec({kind: 'accuseBern', name: 'QA', wrong: {kind: 'accuseBern', no: 120}});
  assert.equal(bern.lines.at(-1).en, 'Verdict No. 120 — lighthouse keeper Bern, imprisoned.');
  const deal = rec({kind: 'dealSeon', name: 'QA', wrong: {kind: 'dealSeon', no: 121}});
  assert.match(deal.lines.at(-1).en, /^Verdict No\. 121 — case closed/);
  const after = rec({kind: 'accuseSeon', name: 'QA', overturned: {kind: 'accuseBern', no: 120}});
  assert.equal(after.lines.at(-1).en, 'Verdict No. 120 — overturned on retrial.');
});

test('a retrial ending frees Bern, files a retrial record, and is remembered next time', () => {
  const g = game();
  assert.match(g.run(`buildEnding4(['accuseSeon','retrial']).en`), /^The cell door opens/);
  const rec = JSON.parse(JSON.stringify(g.run(`officialRecord(4, ['accuseSeon','retrial'], 130)`)));
  assert.equal(rec.stamp.en, 'Retrial');
  assert.equal(g.run(`lastRunLine(runSummary(['accuseSeon','retrial'], 130)).en`), 'In Record No. 130, you overturned the last verdict on retrial. And this time?');
  for (const k of ['retrialNeed', 'wrongH', 'wrongHint']) assert.equal(HANGUL.test(g.run(`UI.${k}.en`)), false);
  for (const c of g.run(`SCENES.accuse.choices.filter(c => c.wrongReq)`)) for (const t of [c.label, c.stake, c.result.text]) assert.equal(HANGUL.test(t.en), false);
});
