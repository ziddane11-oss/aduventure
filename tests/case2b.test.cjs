// pt32 — 사건 2 완결: 2장 「긁힌 자리」(두 곳 탐문·필사소장) → 3장 「붉은 손들」(지우는 밤·이레) → 판결 셋.
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
    globalThis.api = {sceneKey, flags, fate, goto, doChoice, scene};
    const pct = choice =>`), ctx);
  data.set('aduventure_save', JSON.stringify({
    v: 1, sceneKey, flags, ruleKey: 'srd20', fate: 1, specialLeft: 2, breathLeft: 1, tutSeen: true, runNo: 130,
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

const choiceBtns = tree => nodes(tree).filter(n => n.type === 'button' && /^choice( |$)/.test(n.props.className));
const press = (g, re) => { const b = choiceBtns(g.render()).find(n => re.test(text(n))); assert.ok(b, 'button ' + re); b.props.onClick(); return g.state(); };

test('Case 2 now goes on: Ch.1 ends into Ch.2, two stops before sundown, then the copy-master', () => {
  const g = game({sceneKey: 'c2_end', flags: ['accuseSeon']});
  nodes(g.render()).find(n => n.type === 'button' && /Continue to Case 2 · Ch\.2/.test(text(n))).props.onClick();
  assert.equal(g.state().sceneKey, 'c2_day');
  assert.equal(choiceBtns(g.render()).length, 4, 'four places, a lead hub (never folded)');
  let s = press(g, /The ledger room/);
  assert.equal(s.sceneKey, 'c2_day2');
  assert.ok([...s.flags].includes('c2f_pay'));
  assert.ok(!choiceBtns(g.render()).some(b => /ledger room/i.test(text(b))), 'the first stop is gone');
  s = press(g, /The copyists' lodging/);
  assert.equal(s.sceneKey, 'c2_master');
  const labels = choiceBtns(g.render()).map(text);
  assert.ok(labels.some(l => /^\[Ledger\]/.test(l)) && labels.some(l => /^\[Witness\]/.test(l)), 'both leads pay off');
  s = press(g, /^\[Ledger\]/);
  assert.equal(s.sceneKey, 'c2_end2');
  assert.ok([...s.flags].includes('c2_confess'));
});

test('the Ch.2 ending has its own record to object to, and leads into Ch.3', () => {
  const g = game({sceneKey: 'c2_end2', flags: ['c2_confess', 'c2f_pay']});
  const t = text(g.render());
  const comp = name => nodes(g.render()).find(n => typeof n.type === 'function' && n.type.name === name);
  assert.match(comp('RecordCard').props.record.lines[1].en, /Red marks in the margins: found to be scribbles, removed/);
  assert.ok(comp('ObjectionPanel'), 'the objection panel is offered');
  assert.equal(g.run('REBUTTALS[6].line'), 1);
  assert.match(t, /Muk admitted it/);
  nodes(g.render()).find(n => n.type === 'button' && /Continue to Case 2 · Ch\.3/.test(text(n))).props.onClick();
  assert.equal(g.state().sceneKey, 'c2_night');
});

test('the true ending needs both the clean-copy ledger and the chief office letter', () => {
  const lockedV = game({sceneKey: 'c2_verdict', lore: ['c2f_pay']});
  const ex = choiceBtns(lockedV.render()).find(b => /^\[Expose\]/.test(text(b)));
  assert.equal(ex.props.disabled, true);
  assert.ok(choiceBtns(lockedV.render()).some(b => /^\[Preserve\]/.test(text(b)) && !b.props.disabled), 'a first run can still reach an ending');
  const g = game({sceneKey: 'c2_verdict', lore: ['c2f_pay', 'c2f_letter']});
  const s = press(g, /^\[Expose\]/);
  assert.equal(s.sceneKey, 'c2_end3');
  const end = text(g.render());
  const rec = nodes(g.render()).find(n => typeof n.type === 'function' && n.type.name === 'RecordCard').props.record;
  assert.match(rec.lines[0].en, /Clean-copy fees confirmed\. Copy-master dismissed/);
  assert.match(end, /End of Case 2, "The Red Hand\."/);
  assert.match(end, /Case 2, “The Red Hand,” is complete/);
  assert.equal(g.run('badgeId(7, ["c2_expose"])'), '7e');
  assert.equal(g.run('badgeId(7, ["c2_keep"])'), '7k');
  assert.equal(g.run('badgeId(7, ["c2_dealMuk"])'), '7d');
});

test('the letter is won in the erasing room; Ire is revealed as the hand that writes back', () => {
  const g = game({sceneKey: 'c2_scrape'});
  const sc = g.state().scene;
  const steal = sc.choices.find(c => /lift the letter/.test(c.label.en));
  assert.deepEqual([...steal.success.flags], ['c2f_letter']);
  const ire = game({sceneKey: 'c2_ire'});
  assert.match(text(ire.render()), /I sent you the envelope, too/);
});

test('every new Case 2 badge, record and ledger line is bilingual; Muk has a face', () => {
  const g = game();
  const all = JSON.parse(g.run('JSON.stringify([BADGES.filter(b => /^[67]/.test(b.id)), officialRecord(6, ["c2_confess"], 140), officialRecord(7, ["c2_keep"], 140), chapterLedger(6, ["c2f_pay"]), chapterLedger(7, ["c2_expose"]), buildEnding6(["c2_confess"]), buildEnding7(["c2_dealMuk"]), CAST.muk, UI.c2ch2, UI.c2ch3, UI.c2Done])'));
  const walk = v => { if (v && typeof v === 'object') { if ('ko' in v && 'en' in v) { assert.ok(/[가-힣]/.test(v.ko), v.ko); assert.ok(!/[가-힣]/.test(v.en), v.en); } else Object.values(v).forEach(walk); } };
  walk(all);
  assert.match(g.run('PORTRAIT_DRAFTS.muk'), /#c0392b/);
});
