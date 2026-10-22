// pt37 — 아이캐치: 기록 도장(단서·핵심 결정을 처음 얻을 때) + 장 전환 카드(각 장을 처음 시작할 때).
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
    globalThis.api = {sceneKey, flags, fate, goto};
    const pct = choice =>`), ctx);
  data.set('aduventure_save', JSON.stringify({
    v: 1, sceneKey, flags, ruleKey: 'srd20', fate: 1, specialLeft: 2, breathLeft: 1, tutSeen: true, runNo: 130,
    pc: {...vm.runInContext('CLASSES.fighter', ctx), classKey: 'fighter', name: 'QA'}, stats: {rolls: 0, success: 0}
  }));
  const render = () => { index = 0; return vm.runInContext('CRPG()', ctx); };
  nodes(render()).find(n => n.props.className === 'continueBtn').props.onClick();
  const goals = () => expand(render(), 'GoalBox');
  const panel = () => expand(render(), 'ObjectionPanel');
  const card = () => { const el = nodes(render()).find(n => typeof n.type === 'function' && n.type.name === 'RecordCard'); return el.props.record; };
  const press = (cls, pick = 0) => nodes(panel()).filter(n => n.type === 'button' && n.props.className === cls)[pick].props.onClick();
  return {render, goals, panel, card, press, run: c => vm.runInContext(c, ctx), state: () => { render(); return ctx.api; }};
}

test('도장: 새로 얻은 것 중 사건 조각이 먼저, 함께 얻은 것은 모두 본 것으로', () => {
  const g = game();
  const r = JSON.parse(g.run(`JSON.stringify(stampFor(['sabotage'], ['sabotage', 'caughtRen', 'lensCracked', 'f_ren_keeper'], []))`));
  assert.equal(r.id, 'f_ren_keeper');
  assert.deepEqual(r.ids.sort(), ['caughtRen', 'f_ren_keeper']);
  assert.match(r.text.en, /Old Bern/);
  assert.equal(g.run(`stampFor(['sabotage'], ['sabotage', 'caughtRen', 'f_ren_keeper'], ['caughtRen', 'f_ren_keeper'])`), null, '이미 본 건 다시 찍지 않는다');
  assert.equal(g.run(`stampFor([], ['lensCracked', 'duelEdge', 'rebut1'], [])`), null, '기록할 것이 아니면 조용히');
  assert.equal(JSON.parse(g.run(`JSON.stringify(stampFor([], ['keptLens'], []))`)).text.en, 'You kept the lens');
});
test('장 카드: 장 시작 장면을 처음 열 때만', () => {
  const g = game();
  assert.equal(g.run(`chapterCardFor('intro2', [])`), 2);
  assert.equal(g.run(`chapterCardFor('intro2', ['intro2'])`), null);
  assert.equal(g.run(`chapterCardFor('wharf', [])`), null);
  for (const k of ['intro', 'intro2', 'intro3', 'accuse', 'c2_intro', 'c2_day', 'c2_night', 'fin_intro']) {
    const ch = g.run(`chapterCardFor(${JSON.stringify(k)}, [])`);
    assert.ok(ch, k);
    const u = JSON.parse(g.run(`JSON.stringify(UI[CHAPTER_UI[${ch}]])`));
    assert.ok(u.ko && u.en && !HANGUL.test(u.en), k);
    assert.ok(g.run(`!!SCENES[${JSON.stringify(k)}]`), k);
  }
});
test('아이캐치 글은 한/영 둘 다, 영어에 한국어가 섞이지 않는다', () => {
  const g = game();
  const strings = JSON.parse(g.run(`JSON.stringify([...Object.values(STAMP_EXTRA), ...['eyeRecord','eyeNew','eyeSkip','eyeStamp','eyeSeal'].map(k => UI[k])])`));
  for (const s of strings) { assert.ok(s.ko && s.en, JSON.stringify(s)); assert.ok(!HANGUL.test(s.en), s.en); }
  for (const [k, v] of Object.entries(JSON.parse(g.run('JSON.stringify(STAMP_EXTRA)')))) assert.ok(g.run(`Object.values(SCENES).some(sc => JSON.stringify(sc).includes('"${k}"'))`), k + ' is a real flag');
});
test('도장은 입력을 막지 않고, 장 카드는 탭하면 닫힌다 · 움직임 줄이기를 따른다', () => {
  const css = html;
  assert.match(css, /\.eyecatch\.stamp \{ pointer-events:none; \}/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.crpg \.eyecatch/);
});
