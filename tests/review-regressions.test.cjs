// Regressions reproduced from the pt39 browser review.
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

function game({sceneKey = 'ending', flags = [], lore = [], lang = 'en', seenResults, seenScenes, runNo = 113, verdict} = {}) {
  const states = [];
  let index = 0;
  const data = new Map([['aduventure_lang', JSON.stringify(lang)], ['aduventure_lore', JSON.stringify(lore)]]);
  if (seenResults) data.set('aduventure_rseen', JSON.stringify(seenResults));
  if (seenScenes) data.set('aduventure_seen', JSON.stringify(seenScenes));
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
    globalThis.api = {sceneKey, flags, fate, goto, hesitate, lastResult, pc, timerOn, doChoice, scene, applyBranch, setLang, restart, setOpening};
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

const result = tree => nodes(tree).find(n => typeof n.props.className === 'string' && n.props.className.startsWith('result '));


test('a failed attempt to save both is remembered as an attempt, not a choice to drop Ren', () => {
  const g = game({sceneKey: 'railing'});
  const fail = g.run("SCENES.railing.choices.find(c => c.classOnly === 'fighter').fail");
  const line = g.run(`lastRunLine(runSummary(${JSON.stringify(fail.flags)}, 114)).en`);
  assert.match(line, /tried to save both Ren and the lens.*lost your grip/);
  assert.doesNotMatch(line, /let Ren fall/);
});

test('old saves with a kept but cracked lens preserve the failed-both distinction', () => {
  const g = game();
  assert.match(g.run("lastRunLine(runSummary(['keptLens', 'lensCracked'], 114)).en"), /tried to save both/);
  assert.match(g.run("lastRunLine(runSummary(['keptLens', 'f_receipt'], 114)).en"), /grabbed the lens/);
});

test('lifting a paper without a conversation does not manufacture Ren testimony', () => {
  const g = game();
  const flags = g.run("SCENES.stairs.choices.find(c => c.classOnly === 'rogue').success.flags");
  const held = g.run(`heldEvidence(${JSON.stringify(flags)}, [])`);
  assert.ok(held.includes('receipt'));
  assert.ok(!held.includes('testimony'));
  assert.ok(!held.includes('renAccount'));
  assert.doesNotMatch(g.run(`buildEnding1(${JSON.stringify(flags)}).en`), /His words remain/);
});

test('switching languages translates the previous outcome and its damage and clue notices', () => {
  const g = game({sceneKey: 'railing', lang: 'ko'});
  const fail = g.run("SCENES.railing.choices.find(c => c.classOnly === 'fighter').fail");
  g.state().applyBranch(fail, null, null);
  assert.match(text(result(g.render())), /둘 다 놓쳤다/);
  g.state().setLang('en');
  const english = text(result(g.render()));
  assert.ok(!HANGUL.test(english), english);
  assert.match(english, /You lost both/);
  assert.match(english, /damage/);
  g.state().setLang('ko');
  assert.match(text(result(g.render())), /피해/);
});

test('the first record in the archive does not claim that future records were already rewritten', () => {
  const g = game({sceneKey: 'c2_hall', runNo: 113});
  const t = text(g.render());
  assert.doesNotMatch(t, /No\. 114|No\. 115/);
  assert.match(t, /113/);
});

test('the opening earns its first red correction before selecting a class', () => {
  const g = game();
  g.state().restart();
  assert.equal(g.card().rebut, null, 'the document has not corrected itself');
  nodes(g.render()).find(n => n.type === 'button' && /rewrite this record/.test(text(n))).props.onClick();
  assert.equal(g.card().struck, 1);
  assert.match(g.card().rebut.en, /Alive/);
  assert.match(text(g.render()), /hand holding this pen/);
});

test('later objections ask for a statement before evidence; hints stay closed', () => {
  for (const [sceneKey, flags] of [['ending2', ['ledger']], ['ending3', ['f_addressee']]]) {
    const g = game({sceneKey, flags});
    g.press('choice objStart');
    assert.equal(byClass(g.panel(), 'choice objLine').length, 2);
    assert.equal(byClass(g.panel(), 'choice objEvidence').length, 0);
    const hint = nodes(g.panel()).find(n => n.type === 'details' && n.props.className === 'objHint');
    assert.ok(hint && !hint.props.open);
    g.press('choice objLine', 1);
    assert.ok(byClass(g.panel(), 'choice objEvidence').length > 0);
  }
});

test('an unrelated lighthouse receipt cannot disprove the monastery record', () => {
  const g = game({sceneKey: 'ending3', flags: ['f_receipt', 'f_addressee']});
  g.press('choice objStart');
  g.press('choice objLine', 1);
  const ev = byClass(g.panel(), 'choice objEvidence').map(text);
  g.press('choice objEvidence', ev.findIndex(t => t.includes('removal slip')));
  assert.ok(!g.state().flags.includes('rebut3'));
  assert.match(text(g.panel()), /doesn't contradict this line/);
});

test('backing down and resuming does not erase a mistake', () => {
  const g = game({sceneKey: 'ending2', flags: ['ledger', 'trail']});
  g.press('choice objStart');
  g.press('choice objLine', 0);
  g.press('restart');
  g.press('choice objStart');
  g.press('choice objLine', 1);
  const ev = byClass(g.panel(), 'choice objEvidence').map(text);
  g.press('choice objEvidence', ev.findIndex(t => t.includes('Footprints')));
  assert.ok(g.state().flags.includes('rebutX2'));
});

test('each verdict offers a concrete encounter and two conversations in both languages', () => {
  for (const flags of [['accuseSeon'], ['accuseBern'], ['dealSeon'], ['accuseSeon', 'retrial']]) {
    const g = game({sceneKey: 'ending4', flags});
    const scene = g.run(`verdictAftermath(${JSON.stringify(flags)})`);
    assert.equal(scene.questions.length, 2);
    for (const t of [scene.place, scene.text, ...scene.questions.flatMap(q => [q.ask, q.answer])]) {
      assert.ok(HANGUL.test(t.ko) && t.en && !HANGUL.test(t.en));
    }
    const panel = expand(g.render(), 'VerdictAftermath');
    assert.ok(panel, 'encounter is rendered at the verdict');
    assert.equal(nodes(panel).filter(n => n.type === 'details').length, 2);
    assert.match(scene.text.en, flags.includes('accuseBern') ? /bars/ : flags.includes('dealSeon') ? /Seon/ : /empty/);
    if (flags.includes('retrial')) assert.match(scene.text.en, /cell/);
  }
});

test('the first introduction keeps optional commissions out of the main reading flow', () => {
  const first = game({sceneKey: 'intro', runNo: 113});
  assert.equal(first.goals(), null);
  const again = game({sceneKey: 'intro', runNo: 114});
  assert.ok(again.goals());
  assert.ok(nodes(again.render()).some(n => n.type === 'details' && n.props.className === 'optionalGoals' && !n.props.open));
});

test('language switching also translates newly gained fragments without changing HP', () => {
  const g = game({sceneKey: 'stairs', lang: 'ko'});
  g.state().applyBranch(g.run("SCENES.stairs.choices.find(c => c.classOnly === 'rogue').success"), null, null);
  const hp = g.state().pc.hp;
  assert.match(text(result(g.render())), /반박 기록/);
  g.state().setLang('en');
  const english = text(result(g.render()));
  assert.match(english, /Rebuttal recorded/);
  assert.ok(!HANGUL.test(english));
  assert.equal(g.state().pc.hp, hp);
});

test('reversing a deal does not invent an earlier imprisonment of Bern', () => {
  const g = game({sceneKey: 'accuse', verdict: {kind: 'dealSeon', wrong: {kind: 'dealSeon', no: 112}}, lore: ['f_addressee', 'f_hand_match']});
  g.state().applyBranch(g.run('SCENES.accuse.choices.find(c => c.wrongReq).result'), null, null);
  assert.ok(g.state().flags.includes('retrialDeal'));
  const f = JSON.stringify([...g.state().flags]);
  assert.doesNotMatch(g.run(`buildEnding4(${f}).en`), /cell/);
  assert.doesNotMatch(g.run(`verdictAftermath(${f}).text.en`), /cell/);
  assert.doesNotMatch(g.run(`JSON.stringify(officialRecord(4, ${f}, 113).lines)`), /released/);
});

test('the receipt route records Scully surrendering rather than fleeing', () => {
  const g = game({sceneKey: 'confront', flags: ['leadBern']});
  const branch = g.run("SCENES.confront.choices.find(c => c.echoReq === 'leadBern').result");
  g.state().applyBranch(branch, null, null);
  const flags = JSON.stringify([...g.state().flags]);
  assert.match(g.run(`officialRecord(2, ${flags}, 113).lines[0].en`), /arrested/);
  assert.match(g.run(`buildEnding2(${flags}).en`), /authorities/);
  assert.doesNotMatch(g.run(`buildEnding2(${flags}).en`), /Scully is gone/);
  assert.ok(g.run(`heldEvidence(${flags}, []).includes('letters')`));
});

test('letting Scully go still records him leaving with no arrest', () => {
  const g = game();
  assert.match(g.run("officialRecord(2, ['peaceful2'], 113).lines[0].en"), /fled/);
  assert.match(g.run("buildEnding2(['peaceful2']).en"), /Scully is gone/);
});
