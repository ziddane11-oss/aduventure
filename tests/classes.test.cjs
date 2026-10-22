// pt18 — 직업의 길: 장마다 그 직업만 갈 수 있는 길이 있고, 그 길에서 단서 조각을 얻는다.
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

function game({sceneKey = null, cls = 'fighter', lang = 'en'} = {}) {
  const states = [];
  let index = 0;
  const data = new Map([['aduventure_lang', JSON.stringify(lang)], ['aduventure_numbers', 'true']]);
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
  vm.runInContext(app, ctx);
  const render = () => { index = 0; return vm.runInContext('CRPG()', ctx); };
  if (sceneKey) {
    data.set('aduventure_save', JSON.stringify({
      v: 1, sceneKey, flags: [], ruleKey: 'srd20', fate: 1, specialLeft: 2, breathLeft: 1, tutSeen: true,
      pc: {...vm.runInContext(`CLASSES.${cls}`, ctx), classKey: cls, name: 'QA'}, stats: {rolls: 0, success: 0}
    }));
    nodes(render()).find(n => n.props.className === 'continueBtn').props.onClick();
  }
  return {render, run: code => vm.runInContext(code, ctx)};
}
const g0 = game();
const roads = cls => g0.run(`Object.entries(SCENES).flatMap(([k, s]) => (s.choices || []).filter(c => c.classOnly === ${JSON.stringify(cls)} && c.success && [...(c.success.flags || [])].some(f => FRAGMENTS[f])).map(c => ({scene: k, ch: s.ch, c})))`);

for (const cls of ['fighter', 'rogue', 'wizard']) {
  test(`${cls}: one road of its own in every chapter, each leading to a clue fragment`, () => {
    const r = roads(cls);
    assert.deepEqual([...new Set(r.map(x => x.ch))].sort(), [1, 2, 3]);
    for (const {scene, c} of r) {
      assert.ok(c.check && c.stake && c.stake.ko && c.stake.en, scene + ': a road states its risk');
      for (const t of [c.label, c.stake, c.success.text, c.fail.text]) {
        assert.ok(t.ko && t.en, scene);
        assert.equal(HANGUL.test(t.en), false, t.en);
      }
      assert.equal([...(c.fail.flags || [])].some(f => g0.run(`!!FRAGMENTS[${JSON.stringify(f)}]`)), false, scene + ': failing a road yields no fragment');
    }
  });
}

test('the three classes reach different fragments in Chapter 1 and 2', () => {
  const frags = cls => new Set(roads(cls).filter(x => x.ch < 3).flatMap(x => [...x.c.success.flags].filter(f => f.startsWith('f_'))));
  const [f, r, w] = ['fighter', 'rogue', 'wizard'].map(frags);
  assert.ok(f.has('f_ren_keeper') && f.has('f_receipt'), 'Fighter takes both at the railing');
  assert.ok(r.has('f_receipt') && r.has('f_window'), 'Rogue lifts the slip and fishes for the signal');
  assert.ok(w.has('f_window') && w.has('f_fund'), 'Wizard reads the light');
});

// 회차 구조 보존: 1장만으로 조각 3개 이상을 얻으면 2장 베른의 고백(caseMin 3)이 첫 회차에 열려 버린다.
test('no class can collect three fragments in Chapter 1, so the case still needs a second run', () => {
  const scenes = g0.run('SCENES');
  for (const cls of ['fighter', 'rogue', 'wizard']) {
    let best = 0;
    const walk = (key, got, depth) => {
      const s = scenes[key];
      if (!s || s.ch !== 1 || depth > 30 || !s.choices) { best = Math.max(best, got.size); return; }
      for (const c of s.choices) {
        if (c.classOnly && c.classOnly !== cls) continue;
        const branches = c.result ? [c.result] : c.check ? [c.success, c.fail] : [{goto: c.goto}];
        for (const b of branches) {
          const next = new Set(got);
          [...(b.flags || [])].filter(f => f.startsWith('f_')).forEach(f => next.add(f));
          walk(b.goto, next, depth + 1);
          if (b.ifDown) walk(b.ifDown, next, depth + 1);
        }
      }
    };
    walk('intro', new Set(), 0);
    assert.ok(best <= 2, cls + ' could get ' + best);
    assert.ok(best >= 1);
  }
});

test('class cards name the road, and road choices carry a class tag', () => {
  const g = game();
  const tree = g.render();
  byClass(tree, 'choice primaryChoice')[0].props.onClick();
  const cards = byClass(g.render(), 'card');
  assert.equal(cards.length, 3);
  for (const c of cards) assert.match(text(byClass(c, 'road')[0]), /^Class road · /);
  const rail = game({sceneKey: 'railing', cls: 'fighter'}).render();
  const tag = byClass(rail, 'tag cls');
  assert.equal(tag.length, 1);
  assert.match(text(tag[0]), /Fighter's road$/);
  assert.equal(byClass(game({sceneKey: 'railing', cls: 'rogue'}).render(), 'tag cls').length, 0, 'Not your road, not shown');
});

test('taking both is remembered in the ending, the ledger line and the next record', () => {
  const g = game();
  const end3 = g.run(`buildEnding3(['saved3','chase3','both3']).en`);
  assert.match(end3, /gave up nothing/);
  assert.doesNotMatch(end3, /dissolved/);
  assert.equal(g.run(`lastRunLine(runSummary(['saved3','chase3','both3'], 140)).en`), 'In Record No. 140, you saved both the courier and the evidence. And this time?');
  assert.equal(g.run(`lastRunLine(runSummary(['caughtRen','bothRail'], 140)).en`), 'In Record No. 140, you held on to both Ren and the lens. And this time?');
  assert.equal(g.run(`ARTIFACTS.brass_lens.got(['caughtRen','bothRail','fixed'])`), true, 'Both means the lens came back whole');
  for (const k of ['classRoad', 'classRoadH']) assert.equal(HANGUL.test(g.run(`UI.${k}.en`)), false);
  for (const k of ['fighter', 'rogue', 'wizard']) assert.equal(HANGUL.test(g.run(`CLASS_ROADS.${k}.en`)), false);
});
