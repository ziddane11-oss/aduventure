// pt24 — 몰입: 문단이 차례로 번지고(누르면 즉시), 선택지는 글 뒤에 나타나며, 초상 자리가 마련돼 있다.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(process.env.GAME_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');
const app = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1].split('ReactDOM.createRoot')[0];
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
function game(sceneKey, portraits = '') {
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
  vm.runInContext(portraits ? app.replace(/const PORTRAIT_FILES = \{[\s\S]*?\};/, 'const PORTRAIT_FILES = {' + portraits + '};') : app, ctx);
  data.set('aduventure_save', JSON.stringify({
    v: 1, sceneKey, flags: [], ruleKey: 'srd20', fate: 1, specialLeft: 2, breathLeft: 1, tutSeen: true, runNo: 140,
    pc: {...vm.runInContext('CLASSES.fighter', ctx), classKey: 'fighter', name: 'QA'}, stats: {rolls: 0, success: 0}
  }));
  const render = () => { index = 0; return vm.runInContext('CRPG()', ctx); };
  nodes(render()).find(n => n.props.className === 'continueBtn').props.onClick();
  return {render, run: c => vm.runInContext(c, ctx)};
}

test('paragraphs bleed in one after another, and the text itself is unchanged', () => {
  const g = game('c2_hall');
  const narr = byClass(g.render(), 'narr')[0];
  const paras = byClass(narr, 'para');
  const source = g.run(`fmt(SCENES.c2_hall.text.en, {name: 'QA'})`);
  assert.equal(paras.length, source.split('\n\n').length);
  assert.deepEqual(paras.map(p => p.props.style.animationDelay), paras.map((_, i) => Math.min(i * 0.8, 3.2) + 's'));
  assert.equal(text(narr), source);
  const choices = byClass(g.render(), 'choices')[0];
  assert.equal(choices.props['data-stage'], 'staged');
  assert.ok(parseFloat(choices.props.style.animationDelay) >= parseFloat(paras.at(-1).props.style.animationDelay), 'Choices after the last paragraph');
});

test('one tap on the text shows the whole scene at once', () => {
  const g = game('top');
  byClass(g.render(), 'narr')[0].props.onClick();
  const tree = g.render();
  assert.equal(byClass(tree, 'narr')[0].props['data-stage'], 'instant');
  assert.equal(byClass(tree, 'choices')[0].props['data-stage'], 'instant');
});

test('every character has a drawn draft portrait, and a real picture file replaces it', () => {
  const plain = byClass(game('c2_reader').render(), 'castChip')[0];
  assert.match(nodes(plain).find(n => n.type === 'img').props.src, /^data:image\/svg\+xml/, 'Draft by default');
  const g = game('c2_reader');
  assert.deepEqual([...g.run('Object.keys(CAST)')].sort(), [...g.run('Object.keys(PORTRAIT_DRAFTS)')].sort(), 'No one is left without a face');
  for (const svg of g.run('Object.values(PORTRAIT_DRAFTS)')) assert.match(svg, /#c0392b/, 'One red accent each');
  const drawn = byClass(game('c2_reader', 'ire: "art/ire.png"').render(), 'castChip')[0];
  const img = nodes(drawn).find(n => n.type === 'img');
  assert.equal(img.props.src, 'art/ire.png');
  assert.equal(img.props.alt, 'Ire');
});

test('on phones a slim bar follows instead of the big picture: place and health in one line', () => {
  const g = game('dawn2');
  const bar = byClass(g.render(), 'miniBar')[0];
  assert.ok(bar);
  assert.equal(text(byClass(bar, 'mbPlace')[0]), '📍 Before Sundown');
  assert.match(text(byClass(bar, 'mbHp')[0]), /^\d+\/\d+$/);
  assert.match(html, /\.crpg div\.miniBar \{ display:flex;/, 'Shown on phones (slides in once the picture scrolls away; pt46)');
  assert.doesNotMatch(html, /div\.stageWrap \{ position:sticky/, 'The big picture no longer covers the choices');
});
