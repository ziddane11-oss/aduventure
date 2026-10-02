// pt13·pt14 — 「S는 누구인가」: 회차를 넘는 조각, 사건 기록장, 인물 카드, 고발 에필로그.
// 핵심 성질: 한 판으로는 결론 조건을 채울 수 없고, 두 판이면 채울 수 있다.
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
const choices = tree => nodes(tree).filter(n => n.type === 'button' && n.props.className === 'choice');

function game({flags = [], lore = [], lang = 'en', sceneKey = 'intro2'} = {}) {
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
    globalThis.api = {goto, flags, sceneKey};
    const pct = choice =>`), ctx);
  data.set('aduventure_save', JSON.stringify({
    v: 1, sceneKey, flags, ruleKey: 'srd20', fate: 1, specialLeft: 2, breathLeft: 1, tutSeen: true,
    pc: {...vm.runInContext('CLASSES.rogue', ctx), classKey: 'rogue', name: 'QA', hp: 9}, stats: {rolls: 0, success: 0}
  }));
  const render = () => { index = 0; return vm.runInContext('CRPG()', ctx); };
  nodes(render()).find(n => n.props.className === 'continueBtn').props.onClick();
  return {
    render, run: code => vm.runInContext(code, ctx),
    state: () => { render(); return ctx.api; },
    click(label) {
      const b = choices(render()).find(n => text(n).includes(label));
      assert.ok(b, 'Visible choice: ' + label);
      b.props.onClick();
      return render();
    }
  };
}

// ---- 경우의 수: 실제 FRAGMENTS·caseState로 회차를 모형화 ----
const g0 = game();
const run = code => g0.run(code);
// 한 회차에서 서로 배타적인 갈림길과, 각 갈래가 주는 조각.
const CH1 = [[], ['f_ren_keeper'], ['f_receipt'], ['f_window']]; // 설득 / 렌 / 렌즈 / 패배·봉화
const CH2 = [[], ['f_fund'], ['f_hands'], ['f_fund', 'f_hands']]; // 장부·추궁 여부
const CH3 = [['f_addressee'], ['f_hand_match']]; // 사람 / 증거
function playRun(lore, [a, b, c], askBern) {
  const next = new Set([...lore, ...CH1[a]]);
  // 2장 아침: 베른 선택지는 다른 조각 3개 이상일 때만 보인다(실제 caseMin을 사용).
  const others = run(`caseState(${JSON.stringify([...next])}).found.filter(id => id !== 'f_bern_lied').length`);
  const min = run(`SCENES.intro2.choices.find(c => c.frag === 'f_bern_lied').caseMin`);
  if (askBern && others >= min) next.add('f_bern_lied');
  CH2[b].forEach(f => next.add(f));
  CH3[c].forEach(f => next.add(f));
  return [...next];
}
const RUNS = [];
for (let a = 0; a < CH1.length; a++) for (let b = 0; b < CH2.length; b++) for (let c = 0; c < CH3.length; c++) RUNS.push([a, b, c]);

test('the model covers every fragment the game actually hands out', () => {
  const granted = [...run(`[...new Set(Object.values(SCENES).flatMap(s => (s.choices || []).flatMap(c => [c.success, c.fail, c.result]).filter(Boolean).flatMap(b => [b.flag, ...(b.flags || [])]).filter(f => FRAGMENTS[f])))]`)].sort();
  const modeled = [...new Set([...CH1, ...CH2, ...CH3].flat().concat('f_bern_lied'))].sort();
  assert.deepEqual(granted, modeled);
  assert.deepEqual([...run('Object.keys(FRAGMENTS)')].sort(), modeled);
});

test('no single run can reach a verdict, whatever is chosen', () => {
  for (const r of RUNS) for (const ask of [true, false]) {
    const lore = playRun([], r, ask);
    assert.equal(run(`caseState(${JSON.stringify(lore)}).ready`), false, JSON.stringify(r));
  }
});

test('two runs is the minimum, and any first run can still close the case by the third', () => {
  const ready = lore => run(`caseState(${JSON.stringify(lore)}).ready`);
  let twoRun = 0;
  for (const first of RUNS) {
    const lore1 = playRun([], first, true);
    let closable = false;
    for (const second of RUNS) {
      const lore2 = playRun(lore1, second, true);
      if (ready(lore2)) { twoRun++; closable = true; continue; }
      if (!closable && RUNS.some(third => ready(playRun(lore2, third, true)))) closable = true;
    }
    assert.ok(closable, 'The case can close within three runs after ' + JSON.stringify(first));
  }
  assert.ok(twoRun > 0, 'Some two-run paths reach a verdict');
});

test("suspicion first falls on Bern from Ren's word, then shifts to Seon as the case fills", () => {
  const early = run(`caseState(['f_ren_keeper']).score`);
  assert.ok(early.bern > early.seon);
  const late = run(`caseState(['f_ren_keeper','f_hands','f_bern_lied','f_addressee']).score`);
  assert.ok(late.seon > late.bern);
});

// ---- 실제 렌더 ----
test("Bern's confession only opens with 3+ known fragments, then records itself", () => {
  const few = game({lore: ['f_receipt', 'f_fund']});
  assert.equal(choices(few.render()).some(n => text(n).startsWith('[Memory]')), false);
  const g = game({lore: ['f_receipt', 'f_fund', 'f_addressee']});
  const tree = g.click('[Memory]');
  assert.equal(g.state().sceneKey, 'dawn2', 'Then the rounds before sundown');
  assert.ok(g.state().flags.includes('f_bern_lied'));
  assert.ok(text(tree).includes('I never saw a black coat'));
});

test('a fragment choice marks whether its fragment is new or already seen', () => {
  const fresh = choices(game({sceneKey: 'rescue'}).render());
  assert.ok(fresh.every(n => text(n).includes('◇ unseen fragment')));
  const seen = choices(game({sceneKey: 'rescue', lore: ['f_addressee']}).render());
  assert.ok(text(seen[0]).includes('◆ fragment already seen'));
  assert.ok(text(seen[1]).includes('◇ unseen fragment'));
});

test('the sluice choices now hand out the decisive fragments', () => {
  for (const [label, frag, flag] of [['Choose the person', 'f_addressee', 'saved3'], ['Choose the evidence', 'f_hand_match', 'chase3']]) {
    const g = game({sceneKey: 'rescue'});
    g.click(label);
    const s = g.state();
    assert.equal(s.sceneKey, 'ending3');
    assert.ok(s.flags.includes(flag) && s.flags.includes(frag));
  }
});

const READY = ['f_receipt', 'f_hands', 'f_bern_lied', 'f_addressee'];
test('Chapter 3 ending offers the verdict only when the case is ready', () => {
  const locked = game({sceneKey: 'rescue', lore: ['f_receipt']});
  let tree = locked.click('Choose the person');
  assert.ok(text(tree).includes('Case board'));
  assert.ok(text(tree).includes("Bern's statement"));
  assert.equal(nodes(tree).some(n => n.type === 'button' && text(n).includes('reach a verdict')), false);
  const ready = game({sceneKey: 'rescue', lore: READY});
  tree = ready.click('Choose the person');
  nodes(tree).find(n => n.type === 'button' && text(n).includes('reach a verdict')).props.onClick();
  assert.equal(ready.state().sceneKey, 'accuse');
});

for (const [label, flag, badge] of [['[Accuse]', 'accuseSeon', '4t'], ['[Sacrifice]', 'accuseBern', '4b'], ['[Deal]', 'dealSeon', '4d']]) {
  test(`epilogue: ${label} leads to its own ending and badge`, () => {
    const g = game({sceneKey: 'accuse', lore: READY});
    const before = g.render();
    assert.ok(choices(before).every(n => nodes(n).some(x => x.props.className === 'stake')), 'Every verdict shows its cost');
    const tree = g.click(label);
    const s = g.state();
    assert.equal(s.sceneKey, 'ending4');
    assert.ok(s.flags.includes(flag));
    assert.equal(g.run(`badgeId(4, ${JSON.stringify([flag])})`), badge);
    assert.ok(g.run(`BADGES.some(b => b.id === ${JSON.stringify(badge)})`));
    assert.ok(text(tree).includes('End of the Epilogue'));
    assert.ok(nodes(tree).find(n => n.props.className === 'ledger'));
  });
}

for (const lang of ['ko', 'en']) {
  test(`${lang}: characters are introduced by name and role, and the case board lists them`, () => {
    const g = game({lang, sceneKey: 'intro2', lore: ['f_ren_keeper']});
    let tree = g.render();
    const chip = nodes(tree).find(n => n.props.className === 'castChip');
    assert.ok(text(chip).includes(g.run(`CAST.bern.name.${lang}`)) && text(chip).includes(g.run(`CAST.bern.role.${lang}`)));
    nodes(tree).find(n => n.props['aria-label'] === 'case board').props.onClick();
    tree = g.render();
    const board = nodes(tree).find(n => /caseBoard/.test(n.props.className || ''));
    assert.ok(board);
    assert.equal(nodes(board).filter(n => n.props.className === 'suspect').length, 3);
    assert.equal(nodes(board).filter(n => /^frag /.test(n.props.className || '')).length, 8);
    assert.ok(text(board).includes(g.run(`FRAGMENTS.f_ren_keeper.text.${lang}`)));
    assert.ok(text(board).includes(g.run(`UI.fragHint.${lang}`) + g.run(`FRAGMENTS.f_window.where.${lang}`)));
    if (lang === 'en') assert.equal(HANGUL.test(text(board)), false);
  });
}

test('the old keeper and the chief now have names in the story', () => {
  const g = game();
  assert.match(g.run('SCENES.intro.text.ko'), /촌장 세온/);
  assert.match(g.run('SCENES.intro.text.en'), /Seon, the village chief/);
  assert.match(g.run('SCENES.intro.text.ko'), /꼬리표/);
  assert.match(g.run('SCENES.intro2.text.en'), /Bern, the old keeper/);
});

test('all new case and epilogue text is bilingual', () => {
  const g = game();
  const strings = g.run(`(() => {
    const out = [];
    const walk = v => {
      if (!v || typeof v !== 'object') return;
      if (typeof v.ko === 'string' && 'en' in v) { out.push(v); return; }
      Object.values(v).forEach(walk);
    };
    walk([FRAGMENTS, CAST, SCENES.accuse, SCENES.intro2.choices, SCENES.rescue.choices, SCENES.railing, SCENES.signal]);
    walk(['ch4','caseBtn','caseTitle','caseSuspects','caseFrags','caseCast','fragHint','decisiveTag','caseReady','caseNeed','caseLocked','needDecisive','needBern','needCount','fragNew','fragSeen','accuseGo'].map(k => UI[k]));
    for (const f of [['accuseSeon'], ['accuseBern'], ['dealSeon']]) { walk(buildEnding4(f)); walk(chapterLedger(4, f)); }
    walk(BADGES.filter(b => b.ch === 4));
    return out;
  })()`);
  assert.ok(strings.length > 50);
  for (const s of strings) {
    assert.ok(s.ko && s.en, JSON.stringify(s));
    assert.equal(HANGUL.test(s.en), false, s.en);
  }
});
