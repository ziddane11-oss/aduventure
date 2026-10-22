// pt45 — real render regression: readable choices, once-only help, a short opening.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const html = fs.readFileSync(process.env.GAME_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');
const app = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1].split('ReactDOM.createRoot')[0];
function nodes(n, visible = false) {
  if (!n || typeof n !== 'object') return [];
  if (Array.isArray(n)) return n.flatMap(x => nodes(x, visible));
  const children = visible && n.type === 'details' && !n.props.open
    ? n.children.filter(c => c?.type === 'summary') : n.children;
  return [n, ...children.flatMap(c => nodes(c, visible))];
}
function text(n) {
  if (n == null || typeof n === 'boolean') return '';
  if (Array.isArray(n)) return n.map(text).join('');
  return typeof n === 'object' ? text(n.children) : String(n);
}
const byClass = (tree, c) => nodes(tree).filter(n => n.props.className === c);
const choices = tree => nodes(tree, true).filter(n => n.type === 'button' && /^choice(?: |$)/.test(n.props.className));
function game({sceneKey = 'door', flags = [], lore = [], classKey = 'fighter', lang = 'ko', runNo = 130,
  tutSeen = false, storage = {}, introStep, fresh = false} = {}) {
  const states = [], intervals = [], effects = [];
  let index = 0;
  const data = new Map(Object.entries({aduventure_lang: lang, aduventure_lore: lore, ...storage}).map(([k, v]) => [k, JSON.stringify(v)]));
  const ctx = vm.createContext({console, Date, Math: Object.assign(Object.create(Math), {random: () => 0.999}),
    setTimeout: () => 0, clearTimeout() {}, setInterval: fn => intervals.push(fn) - 1, clearInterval: i => intervals[i] = null,
    window: {addEventListener() {}}, document: {documentElement: {}},
    fetch: async () => { throw new Error('Network disabled'); },
    localStorage: {getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k)},
    React: {Fragment: 'fragment', createElement: (type, props, ...children) => ({type, props: props || {}, children}),
      useState(initial) { const i = index++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
        return [states[i], v => states[i] = typeof v === 'function' ? v(states[i]) : v]; },
      useRef(initial) { const i = index++; if (!(i in states)) states[i] = {current: initial}; return states[i]; },
      useEffect(fn) { effects.push(fn); }
    }});
  const api = 'sceneKey, flags, pc, goto, setSceneKey, setFlags, setLore, setMoreOpen, setTakenAtRun, setSeenAtRun, setLang, setTutSeen, setNumbersOn, restart, visibleChoices';
  vm.runInContext(app.replace('  const pct = choice =>', `globalThis.api = {${api}};\n  const pct = choice =>`), ctx);
  if (!fresh) data.set('aduventure_save', JSON.stringify({v: 1, sceneKey, flags, ruleKey: 'srd20', fate: 0,
    specialLeft: 2, breathLeft: 1, tutSeen, runNo, introStep,
    pc: {...vm.runInContext(`CLASSES.${classKey}`, ctx), hp: 12, classKey, name: 'QA'}, stats: {rolls: 0, success: 0}}));
  const render = () => { index = 0; effects.length = 0; return vm.runInContext('CRPG()', ctx); };
  if (!fresh) byClass(render(), 'continueBtn')[0].props.onClick();
  return {render, data, run: c => vm.runInContext(c, ctx), api: () => {render(); return ctx.api;},
    flush: () => {for (let i = 0; i < 12; i++) intervals.forEach(fn => fn && fn());},
    save: () => {render(); const effect = effects.find(fn => fn.toString().includes('const snapshot =')); assert.ok(effect); effect();}};
}

if (process.env.CLARITY_METRICS) {
  for (const lang of ['ko', 'en']) for (const [sceneKey, flags] of [['door', []], ['wharf', ['peaceful', 'keptLens', 'leadManifest']], ['monk1', ['leadBell']]]) {
    const g = game({sceneKey, flags, lang});
    const tree = g.render();
    // Count auxiliary copy around narrative choices, not prose, labels, or hidden panels.
    const classes = ['checkBrief', 'echo-h', 'locDoing', 'noteBtn'];
    const annotations = nodes(tree, true).filter(n => classes.includes(n.props.className));
    const choiceAnnotations = choices(tree).flatMap(b => b.children.filter(c => c && typeof c === 'object'));
    const suggestion = nodes(tree, true).some(n => typeof n.type === 'function' && n.type.name === 'SuggestBox') ? g.run(`UI.suggestBtn.${lang}`) : '';
    console.log(JSON.stringify({lang, sceneKey, actions: choices(tree).length, auxiliaryCharacters: [...text(annotations), ...text(choiceAnnotations), ...suggestion].length}));
  }
} else {
  test('all narrative scenes keep four initial actions across class, flag and progress combinations', t => {
    const inventory = game();
    const scenes = inventory.run('SCENES');
    let cases = 0;
    for (const classKey of ['fighter', 'rogue', 'wizard']) {
      const g = game({classKey, lore: Object.keys(inventory.run('FRAGMENTS')), storage: {aduventure_artifacts: Object.keys(inventory.run('ARTIFACTS'))}});
      for (const [id, scene] of Object.entries(scenes)) {
        if (!scene.choices) continue;
        const gates = [...new Set(scene.choices.flatMap(c => [c.echoReq, c.flagNot]).filter(Boolean))];
        const loreGates = [...new Set(scene.choices.map(c => c.loreReq).filter(Boolean))];
        for (let mask = 0; mask < 2 ** gates.length; mask++) for (const remembered of [false, true]) {
          const a = g.api();
          a.setSceneKey(id); a.setMoreOpen(null);
          a.setFlags(gates.filter((_, i) => mask & (1 << i)));
          a.setLore(remembered ? [...Object.keys(inventory.run('FRAGMENTS')), ...loreGates] : []);
          a.setSeenAtRun(remembered ? [id] : []);
          a.setTakenAtRun(remembered ? scene.choices.filter((_, i) => i % 2).map(c => `${id}:${scene.choices.indexOf(c)}`) : []);
          const tree = g.render();
          const shown = choices(tree);
          assert.ok(shown.length <= 4, `${id}/${classKey}/${mask}/${remembered}: ${shown.length}`);
          const expected = g.api().visibleChoices.map(c => c.label[langOf(g)]);
          const more = byClass(tree, 'moreChoices')[0];
          if (more) more.props.onClick();
          const expanded = choices(g.render()).map(text);
          assert.equal(expanded.length, expected.length, `${id}: expansion loses no action`);
          for (const label of expected) assert.ok(expanded.some(t => t.startsWith(label)), `${id}: ${label}`);
          cases++;
        }
      }
    }
    assert.ok(cases > 500);
    t.diagnostic(`${Object.keys(scenes).length} total scenes; ${Object.values(scenes).filter(s => s.choices).length} narrative scenes, ${cases} render combinations`);
  });
  function langOf(g) { return JSON.parse(g.data.get('aduventure_lang')); }

  test('returning-player shortcuts stay available without adding six actions to the opening', () => {
    const g = game({sceneKey: 'intro', storage: {aduventure_badges: ['1A', '2A'], aduventure_verdict: {kind: 'accuseSeon'}}});
    g.api().setSeenAtRun(['intro', 'stairs', 'rescue']);
    assert.ok(choices(g.render()).length <= 4);
    assert.match(text(byClass(g.render(), 'narr')[0]), /곡식과 약.*겨울/s, 'Returning players also see the new motive seed');
    const routes = byClass(g.render(), 'replayRoutes')[0];
    assert.ok(routes && routes.type === 'details' && !routes.props.open);
    assert.equal(choices({...routes, props: {...routes.props, open: true}}).length, 5);
  });

  test('class actions are visible and disabled actions keep their requirements', () => {
    for (const [sceneKey, classKey] of [['wharf', 'rogue'], ['railing', 'fighter'], ['top', 'wizard']]) {
      const g = game({sceneKey, classKey, flags: ['peaceful', 'keptLens', 'leadManifest'], lore: ['ledger']});
      const classChoice = g.api().visibleChoices.find(c => c.classOnly === classKey);
      if (classChoice) assert.ok(choices(g.render()).some(n => text(n).startsWith(classChoice.label.ko)));
    }
    const g = game({sceneKey: 'accuse'});
    const locked = choices(g.render()).filter(n => n.props.disabled);
    assert.ok(locked.length > 0);
    assert.ok(locked.every(n => nodes(n).some(n => /lock/.test(n.props.className))));
  });

  test('default choices show actions without forecasts; detailed mode restores rule information', () => {
    for (const lang of ['ko', 'en']) {
      const g = game({sceneKey: 'railing', lang});
      assert.equal(choices(g.render()).flatMap(b => byClass(b, 'stake')).length, 0);
      assert.doesNotMatch(choices(g.render()).map(text).join(' '), /\d+%|쉬움|반반|어려움|easy|even odds|hard/);
      g.api().setNumbersOn(true);
      assert.ok(choices(g.render()).flatMap(b => byClass(b, 'stake')).length > 0);
      assert.match(choices(g.render()).map(text).join(' '), /\d+%/);
    }
  });

  test('first check teaches once, including after a reload without a save', () => {
    const g = game();
    assert.equal(byClass(g.render(), 'checkBrief').length, 1);
    choices(g.render())[0].props.onClick(); g.flush();
    assert.equal(byClass(g.render(), 'checkBrief').length, 0);
    assert.equal(g.data.get('aduventure_check_seen'), 'true');
    const next = game({storage: {aduventure_check_seen: true}});
    assert.equal(byClass(next.render(), 'checkBrief').length, 0);
  });

  test('three short opening pages follow the redline hook, survive language/save changes and skip to the motive', () => {
    for (const lang of ['ko', 'en']) {
      const fresh = game({lang, fresh: true});
      assert.ok(nodes(fresh.render()).some(n => typeof n.type === 'function' && n.type.name === 'RecordCard'));
      assert.equal(byClass(fresh.render(), 'prologueNav').length, 0, 'the official record is still the first interaction');
      const g = game({sceneKey: 'intro', runNo: 113, lang});
      assert.match(text(byClass(g.render(), 'prologueNav')[0]), /1.*3/);
      byClass(g.render(), 'prologueNext')[0].props.onClick();
      const hp = g.api().pc.hp;
      g.api().setLang(lang === 'ko' ? 'en' : 'ko');
      assert.match(text(byClass(g.render(), 'prologueNav')[0]), /2.*3/);
      assert.equal(g.api().pc.hp, hp);
      g.save();
      const save = JSON.parse(g.data.get('aduventure_save'));
      assert.equal(save.introStep, 1);
      const restored = game({sceneKey: 'intro', runNo: 113, lang, introStep: save.introStep});
      assert.match(text(byClass(restored.render(), 'prologueNav')[0]), /2.*3/);
      byClass(restored.render(), 'prologueSkip')[0].props.onClick();
      assert.match(text(byClass(restored.render(), 'narr')[0]), lang === 'ko' ? /곡식과 약.*겨울/s : /grain and medicine.*winter/s);
      assert.equal(choices(restored.render()).length, 1);
      choices(restored.render())[0].props.onClick();
      assert.equal(restored.api().sceneKey, 'door');
      assert.ok(!restored.api().flags.some(f => /^f_/.test(f)), 'motive foreshadowing is not evidence or a verdict');
    }
  });
}
