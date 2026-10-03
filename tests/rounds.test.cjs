// pt21 — 해 지기 전 두 곳: 2·3장 시작에 시간 예산 탐문. 들은 것이 같은 장의 길을 연다.
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

function game({sceneKey, flags = []}) {
  const states = [];
  let index = 0;
  const data = new Map([['aduventure_lang', JSON.stringify('en')]]);
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
    v: 1, sceneKey, flags, ruleKey: 'srd20', fate: 1, specialLeft: 2, breathLeft: 1, tutSeen: true,
    pc: {...vm.runInContext('CLASSES.fighter', ctx), classKey: 'fighter', name: 'QA'}, stats: {rolls: 0, success: 0}
  }));
  const render = () => { index = 0; return vm.runInContext('CRPG()', ctx); };
  nodes(render()).find(n => n.props.className === 'continueBtn').props.onClick();
  const choices = () => nodes(byClass(render(), 'choices')[0]).filter(n => n.type === 'button');
  const click = prefix => choices().find(b => text(b).startsWith(prefix)).props.onClick();
  return {choices, click, run: c => vm.runInContext(c, ctx), state: () => { render(); return ctx.api; }};
}
const g0 = game({sceneKey: 'dawn2'});

for (const [hub, second, next, leads] of [
  ['dawn2', 'dawn2b', 'wharf', ['leadManifest', 'leadOil', 'leadBern', 'leadWindow']],
  ['dusk3', 'dusk3b', 'cloister', ['leadPilgrim', 'leadPost', 'leadSmith']]
]) {
  test(`${hub}: two stops before sundown, never the same one twice, then on`, () => {
    const g = game({sceneKey: hub});
    assert.equal(g.choices().length, leads.length + 1, 'Every stop, plus skipping the rounds');
    const first = text(g.choices()[0]).split(/At stake/)[0];
    g.click(first.slice(0, 12));
    let s = g.state();
    assert.equal(s.sceneKey, second);
    assert.deepEqual([...s.flags], [leads[0]]);
    assert.equal(g.choices().some(b => text(b).startsWith(first.slice(0, 12))), false, 'A visited stop is gone');
    assert.equal(g.choices().length, leads.length);
    g.choices()[0].props.onClick();
    s = g.state();
    assert.equal(s.sceneKey, next);
    assert.deepEqual([...s.flags], [leads[0], leads[1]], 'Two leads at most');
  });

  test(`${hub}: every lead opens a road later in the same chapter, and only with that lead`, () => {
    const ch = g0.run(`SCENES.${hub}.ch`);
    for (const lead of leads) {
      const where = g0.run(`Object.entries(SCENES).filter(([k, s]) => s.ch === ${ch} && (s.choices || []).some(c => c.echoReq === ${JSON.stringify(lead)})).map(([k]) => k)`);
      assert.equal(where.length, 1, lead);
      const scene = where[0];
      const label = g0.run(`SCENES.${scene}.choices.find(c => c.echoReq === ${JSON.stringify(lead)}).label.en`);
      assert.equal(game({sceneKey: scene}).choices().some(b => text(b).startsWith(label.slice(0, 10))), false, lead + ' hidden without the lead');
      const g = game({sceneKey: scene, flags: [lead]});
      assert.ok(g.choices().some(b => text(b).startsWith(label.slice(0, 10))), lead + ' shown with the lead');
    }
  });
}

test('the rounds never hand out clue fragments, so the case still needs several records', () => {
  const branches = g0.run(`['dawn2','dawn2b','dusk3','dusk3b'].flatMap(k => SCENES[k].choices.map(c => c.result).filter(Boolean)).concat(Object.values(SCENES).flatMap(s => (s.choices || []).filter(c => c.echoReq && c.echoReq.startsWith('lead')).map(c => c.result)))`);
  assert.ok(branches.length >= 14);
  for (const b of branches) assert.equal([...(b.flags || [])].some(f => f.startsWith('f_')), false, JSON.stringify(b.flags));
});

test('chapter openings lead into the rounds', () => {
  assert.deepEqual([...g0.run(`SCENES.intro2.choices.map(c => c.goto || c.result.goto)`)], ['dawn2', 'dawn2']);
  assert.equal(g0.run(`SCENES.intro3.choices[0].goto`), 'dusk3');
});

test('all round text is bilingual', () => {
  const out = g0.run(`(() => {
    const o = [];
    for (const k of ['dawn2','dawn2b','dusk3','dusk3b']) {
      o.push(SCENES[k].text, SCENE_TITLES[k], SCENE_DOING[k]);
      for (const c of SCENES[k].choices) o.push(c.label, c.stake, c.result && c.result.text);
    }
    for (const s of Object.values(SCENES)) for (const c of s.choices || []) if (c.echoReq && c.echoReq.startsWith('lead')) o.push(c.label, c.stake, c.echo, c.result.text);
    return o.filter(Boolean);
  })()`);
  for (const t of out) {
    assert.ok(t.ko && t.en, JSON.stringify(t));
    assert.equal(HANGUL.test(t.en), false, t.en);
  }
});
