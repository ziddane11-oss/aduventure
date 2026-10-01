// pt11 — 패배 후 봉화, 렌과 렌즈의 선택, 철사의 다른 용도, 판정 없는 핵심 단서, 결과 카드.
// 실제 렌더·클릭 핸들러를 실행한다(choices.test.cjs와 같은 방식). 레이아웃은 범위 밖.
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
function choices(tree) {
  return nodes(tree).filter(node => node.type === 'button' && node.props.className === 'choice');
}

function game({flags = [], lang = 'en', sceneKey = 'top', classKey = 'fighter', hp = 8, success = true} = {}) {
  const states = [], intervals = [], sent = [];
  let index = 0;
  const data = new Map([['aduventure_lang', JSON.stringify(lang)]]);
  const ctx = vm.createContext({
    console, Date, Math: Object.assign(Object.create(Math), {random: () => success ? 0.999 : 0}),
    setTimeout: () => 0, clearTimeout() {},
    setInterval: fn => intervals.push(fn) - 1,
    clearInterval: id => intervals[id] = null,
    window: {addEventListener() {}}, document: {documentElement: {}},
    fetch: async (url, init) => { sent.push(init); throw new Error('Network disabled in unit tests'); },
    localStorage: {
      getItem: key => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, value),
      removeItem: key => data.delete(key)
    },
    React: {
      Fragment: 'fragment',
      createElement: (type, props, ...children) => ({type, props: props || {}, children}),
      useState(initial) {
        const i = index++;
        if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
        return [states[i], value => states[i] = typeof value === 'function' ? value(states[i]) : value];
      },
      useRef(initial) {
        const i = index++;
        if (!(i in states)) states[i] = {current: initial};
        return states[i];
      },
      useEffect() {}
    }
  });
  vm.runInContext(app.replace('  const pct = choice =>', `
    globalThis.api = {goto, setPc, pc, flags, sceneKey, lastResult, trapUsed};
    const pct = choice =>`), ctx);
  data.set('aduventure_save', JSON.stringify({
    v: 1, sceneKey, flags, ruleKey: 'srd20', fate: 0, specialLeft: 2, breathLeft: 1, tutSeen: true,
    pc: {...vm.runInContext(`CLASSES[${JSON.stringify(classKey)}]`, ctx), classKey, name: 'QA', hp},
    stats: {rolls: 0, success: 0}
  }));
  const render = () => { index = 0; return vm.runInContext('CRPG()', ctx); };
  nodes(render()).find(node => node.props.className === 'continueBtn').props.onClick();
  const g = {
    render,
    run: code => vm.runInContext(code, ctx),
    state: () => { render(); return ctx.api; },
    click(label) {
      const button = choices(render()).find(node => text(node).includes(label));
      assert.ok(button, 'Visible choice: ' + label);
      button.props.onClick();
      return render();
    },
    finishRoll() {
      for (let tick = 0; tick < 12 && intervals.some(Boolean); tick++) intervals.forEach(fn => fn && fn());
    },
    sent
  };
  return g;
}

test('losing to Ren continues to a beacon at 1 HP instead of game over', () => {
  const g = game({sceneKey: 'stairs'});
  assert.equal(g.run('SCENES.combat.defeat.goto'), 'signal');
  g.state().setPc(p => ({...p, hp: 0}));
  g.state().goto('signal');
  assert.equal(g.state().sceneKey, 'signal');
  assert.equal(g.state().pc.hp, 1, 'The defeat path wakes with 1 HP');
  assert.ok(g.sent.some(init => String(init?.body).includes('defeat_continue')), 'The continued defeat is recorded');
  const tree = g.click('Haul the oil barrel');
  const s = g.state();
  assert.equal(s.sceneKey, 'ending');
  for (const f of ['signal', 'sabotage']) assert.ok(s.flags.includes(f), f);
  assert.ok(text(tree).includes('it was pulled out'), 'The core clue is shown without a check');
  assert.ok(text(tree).includes('Following a beacon with no lens'));
  assert.equal(g.run('badgeId(1, ["signal", "sabotage"])'), '1s');
  assert.ok(g.run('BADGES.some(b => b.id === "1s")'));
  const ledger = nodes(tree).find(n => n.props.className === 'ledger');
  assert.ok(text(ledger).includes('Lens — Ren ran off with it'));
  assert.equal(nodes(tree).some(n => n.props.className === 'resChip'), false, 'No dice chip for a no-check result');
});

test('other combat outcomes still use their old game-over rule', () => {
  assert.equal(game().run('SCENES.combat2.defeat.goto'), 'gameover');
  assert.equal(game().run('SCENES.combat3.defeat.goto'), 'gameover');
});

for (const [label, gained, artifact] of [
  ["Grab Ren's wrist", ['caughtRen', 'lensCracked', 'f_ren_keeper'], false],
  ['Grab the lens sack', ['keptLens', 'f_receipt'], true]
]) {
  test(`railing: "${label}" trades one thing for another`, () => {
    const g = game({sceneKey: 'railing'});
    assert.equal(g.run('SCENES.combat.victory.goto'), 'railing');
    assert.equal(choices(g.render()).length, 2);
    g.click(label);
    const s = g.state();
    assert.equal(s.sceneKey, 'top');
    assert.deepEqual([...s.flags], gained);
    assert.equal(s.pc.hp, 8, 'The choice itself costs no HP');
    assert.equal(g.run(`ARTIFACTS.brass_lens.got(${JSON.stringify([...gained, 'fixed'])})`), artifact);
  });
}

test('wire repair is available only with a found, unspent wire, and needs no check', () => {
  const wire = '[Wire]';
  assert.equal(choices(game({flags: []}).render()).some(n => text(n).includes(wire)), false);
  assert.equal(choices(game({flags: ['sawTrap', 'wireUsed']}).render()).some(n => text(n).includes(wire)), false);
  const g = game({flags: ['sawTrap']});
  const tree = g.click(wire);
  const s = g.state();
  assert.equal(s.sceneKey, 'ending');
  for (const f of ['jury', 'wired', 'sabotage']) assert.ok(s.flags.includes(f), f);
  assert.equal(s.flags.includes('fixed'), false, 'The wire is a safe stopgap, not a full repair');
  assert.equal(s.pc.hp, 8);
  assert.ok(text(tree).includes('The wire-lashed gear holds firm'));
});

test('spending the trap in the Ren fight uses up the wire for the repair', () => {
  const g = game({sceneKey: 'stairs', flags: ['sawTrap']});
  g.state().goto('combat');
  assert.ok(text(g.render()).includes(g.run('UI.trapTag.en')), 'The trap shows that it uses up the wire');
  g.click('Drive him into the oil & wire');
  assert.equal(g.state().trapUsed, true);
  g.state().goto('railing');
  assert.ok(g.state().flags.includes('wireUsed'));
  g.click("Grab Ren's wrist");
  assert.equal(choices(g.render()).some(n => text(n).includes('[Wire]')), false);
});

for (const success of [true, false]) {
  for (const skill of ['Analyze the mechanism', '[Athletics]']) {
    test(`top: ${skill} ${success ? 'success' : 'failure'} shows the sabotage clue`, () => {
      const g = game({success});
      g.click(skill);
      g.finishRoll();
      const tree = g.render();
      assert.ok(g.state().flags.includes('sabotage'));
      assert.ok(text(tree).includes('it was pulled out'));
      assert.ok(text(tree).includes('Clue found — A gear pulled out on purpose'));
    });
  }
}

test('every branch that grants the sabotage clue shows it in both languages', () => {
  const branches = game().run(`Object.values(SCENES).flatMap(s => (s.choices || []).flatMap(c => [c.success, c.fail, c.result])).filter(b => b && [b.flag, ...(b.flags || [])].includes('sabotage'))`);
  assert.ok(branches.length >= 6);
  for (const b of branches) {
    assert.match(b.text.ko, /빼낸 것/);
    assert.match(b.text.en, /pulled out/);
  }
});

test('Chapter 2 remembers what Chapter 1 kept and lost', () => {
  const tree = game({sceneKey: 'wharf', flags: ['caughtRen']}).render();
  assert.ok(text(tree).includes('Ren, whom you caught at the railing'));
  assert.ok(choices(tree).some(n => text(n).includes('remembers the hand that caught him')));
  const grudge = game({sceneKey: 'wharf', flags: ['keptLens']}).render();
  assert.ok(text(grudge).includes('glares at you'));
  assert.equal(choices(grudge).some(n => text(n).startsWith('[Bond]')), false);
  const g = game({sceneKey: 'wharf', flags: ['signal']});
  g.click('[Deal]');
  assert.equal(g.state().sceneKey, 'wharfLens');
  assert.ok(g.state().flags.includes('lensBack'));
  const pressed = game({sceneKey: 'confront', flags: ['sabotage']}).render();
  assert.ok(text(pressed).includes("There's a gap in Scully's story"));
  assert.ok(choices(pressed).some(n => text(n).startsWith('[Press]')));
});

test('new choices are appended, keeping earlier telemetry choice indexes', () => {
  const g = game();
  assert.equal(g.run('SCENES.wharf.choices[3].echoReq'), 'caughtRen');
  assert.equal(g.run('SCENES.wharf.choices[4].echoReq'), 'signal');
  assert.equal(g.run('SCENES.confront.choices[4].label.en'), '[Fight] Subdue him and hand him to the law');
  assert.equal(g.run('SCENES.confront.choices[5].echoReq'), 'sabotage');
  assert.equal(g.run('SCENES.top.choices[2].flagNot'), 'wireUsed');
});

test('new text is bilingual, with no Korean in the English side', () => {
  const g = game();
  const strings = g.run(`(() => {
    const out = [];
    const walk = v => {
      if (!v || typeof v !== 'object') return;
      if (typeof v.ko === 'string' && 'en' in v) { out.push(v); return; }
      Object.values(v).forEach(walk);
    };
    walk(['railing', 'signal', 'wharfLens'].map(k => SCENES[k]));
    walk([SCENES.top.choices[2], SCENES.wharf.choices.slice(3), SCENES.confront.choices[5], SCENES.combat.victory, SCENES.combat.defeat]);
    walk([ECHOES, CLUES.sabotage, BADGES.find(b => b.id === '1s'), UI.trapTag, UI.ledgerH, SCENE_TITLES]);
    const combos = [['signal','sabotage'], ['caughtRen','lensCracked','fixed','sabotage','wireUsed'], ['keptLens','wired','sabotage'], ['peaceful','jury'],
      ['lensBack','ledger','peaceful2'], ['saved3','keeper'], ['chase3']];
    for (const f of combos) for (const ch of [1, 2, 3]) walk(chapterLedger(ch, f));
    for (const f of combos) walk(buildEnding1(f));
    return out;
  })()`);
  assert.ok(strings.length > 60);
  for (const s of strings) {
    assert.ok(s.ko && s.en, JSON.stringify(s));
    assert.equal(HANGUL.test(s.en), false, 'Korean in English text: ' + s.en);
  }
});

for (const lang of ['ko', 'en']) {
  test(`${lang}: the ending ledger names what was kept, lost and what follows`, () => {
    const g = game({lang, sceneKey: 'railing'});
    g.click(lang === 'en' ? 'Grab the lens sack' : '렌즈 자루를 잡는다');
    g.state().goto('ending', ['fixed', 'sabotage']);
    const tree = g.render();
    const ledger = nodes(tree).find(n => n.props.className === 'ledger');
    const t = text(ledger);
    assert.ok(t.includes(g.run(`UI.ledgerH.${lang}`)));
    assert.equal(nodes(ledger).filter(n => /^ledgerRow /.test(n.props.className || '')).length >= 2, true);
    assert.ok(t.includes(lang === 'en' ? "Ren won't talk at the docks" : '부두의 렌은 입을 열지 않는다'));
    if (lang === 'en') assert.equal(HANGUL.test(t), false);
  });
}
