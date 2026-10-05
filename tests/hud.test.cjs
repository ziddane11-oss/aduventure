// pt46 — 휴대폰 첫 화면에서 본문을 위로: 위치·체력을 두 번 보여 주지 않고, 상단 줄을 한 줄로.
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
  const states = [], listeners = {}, effects = [];
  let index = 0;
  const data = new Map([['aduventure_lang', JSON.stringify('en')]]);
  const ctx = vm.createContext({
    console, Date, Math, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    window: {addEventListener(t, fn) { listeners[t] = fn; }, removeEventListener() {}, scrollY: 0}, document: {documentElement: {}},
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
      useEffect(fn) { effects.push(fn); }
    }
  });
  vm.runInContext(portraits ? app.replace(/const PORTRAIT_FILES = \{[\s\S]*?\};/, 'const PORTRAIT_FILES = {' + portraits + '};') : app, ctx);
  data.set('aduventure_save', JSON.stringify({
    v: 1, sceneKey, flags: [], ruleKey: 'srd20', fate: 1, specialLeft: 2, breathLeft: 1, tutSeen: true, runNo: 140,
    pc: {...vm.runInContext('CLASSES.fighter', ctx), classKey: 'fighter', name: 'QA'}, stats: {rolls: 0, success: 0}
  }));
  const render = () => { index = 0; effects.length = 0; const t = vm.runInContext('CRPG()', ctx); effects.splice(0).forEach(fn => { try { fn(); } catch (e) {} }); return t; };
  nodes(render()).find(n => n.props.className === 'continueBtn').props.onClick();
  return {render, run: c => vm.runInContext(c, ctx), listeners};
}

const hasClass = (n, c) => typeof n.props.className === 'string' && n.props.className.split(' ').includes(c);
const firstByClass = (tree, c) => nodes(tree).find(n => hasClass(n, c));

test('the slim place/health bar stays hidden at the top and slides in only after the picture scrolls away', () => {
  const g = game('door');
  let bar = firstByClass(g.render(), 'miniBar');
  assert.ok(bar, 'Still rendered (place and health while scrolling)');
  assert.equal(hasClass(bar, 'show'), false, 'At the top the picture card already shows the place');
  assert.equal(typeof g.listeners.scroll, 'function', 'Listens to scrolling');
  g.run('window.scrollY = 600'); g.listeners.scroll(); bar = firstByClass(g.render(), 'miniBar');
  assert.equal(hasClass(bar, 'show'), true);
  g.run('window.scrollY = 0'); g.listeners.scroll(); bar = firstByClass(g.render(), 'miniBar');
  assert.equal(hasClass(bar, 'show'), false);
  assert.match(html, /\.crpg div\.miniBar:not\(\.show\) \{[^}]*transform:translateY\(-1\d\d%\)/, 'Hidden bar takes no space on phones');
  assert.match(html, /\.crpg div\.miniBar \{ display:flex; position:fixed;/, 'Fixed, so it never pushes the story down');
});

test('on phones the header is one row: the chapter subtitle hides and the rules button shrinks to "?"', () => {
  const g = game('door');
  const tree = g.render();
  const header = nodes(tree).find(n => n.type === 'header');
  const sub = firstByClass(header, 'hSub');
  assert.ok(sub && /v0\.7\.3-pt\d+/.test(text(sub)), 'Build tag stays in the header markup on desktop');
  const rules = nodes(header).find(n => n.type === 'button' && /Rules/.test(text(n)));
  assert.ok(firstByClass(rules, 'hLbl'), 'The word "Rules" can hide on phones');
  assert.equal(rules.props['aria-label'], 'Rules');
  assert.match(html, /@media \(max-width: 700px\) \{[\s\S]*?\.crpg h1 \.hSub, \.crpg \.hctrl \.hLbl \{ display:none; \}/);
  assert.match(text(nodes(tree).find(n => n.type === 'summary')), /v0\.7\.3-pt\d+/, 'Build tag is visible at the bottom without opening credits');
});

// pt47 — 영어에서도 상단이 한 줄: 덜 쓰는 버튼(쪽지·소리·숫자)은 휴대폰에서 '⋯' 아래로.
test('on phones the less-used header buttons fold behind a "⋯" toggle; nothing is removed', () => {
  const g = game('door');
  let header = nodes(g.render()).find(n => n.type === 'header');
  const more = nodes(header).filter(n => hasClass(n, 'hMore'));
  assert.equal(more.length, 3, 'Feedback, sound and numbers stay in the markup');
  const ctrl = firstByClass(header, 'hctrl');
  assert.equal(hasClass(ctrl, 'open'), false);
  const toggle = firstByClass(header, 'hMoreBtn');
  assert.ok(toggle, 'A "⋯" button exists');
  assert.equal(toggle.props['aria-expanded'], false);
  toggle.props.onClick();
  header = nodes(g.render()).find(n => n.type === 'header');
  assert.equal(hasClass(firstByClass(header, 'hctrl'), 'open'), true);
  assert.equal(firstByClass(header, 'hMoreBtn').props['aria-expanded'], true);
  assert.match(html, /\.crpg \.hMoreBtn \{ display:none; \}/, 'Desktop keeps every button visible');
  assert.match(html, /@media \(max-width: 700px\) \{[\s\S]*?\.crpg \.hctrl:not\(\.open\) \.hMore \{ display:none; \}[\s\S]*?\.crpg \.hctrl \.hMoreBtn \{ display:inline-block; \}/, 'More specific than the later desktop rule, so it wins on phones');
});

test('class cards on phones show the road name only; the explanation stays for desktop and the scene labels', () => {
  const g = game('door');
  assert.deepEqual(JSON.parse(JSON.stringify(g.run('roadParts("둘 다 잡는다 — 남들이 하나를 버릴 때")'))), ['둘 다 잡는다', ' — 남들이 하나를 버릴 때']);
  assert.deepEqual(JSON.parse(JSON.stringify(g.run('roadParts("No dash here")'))), ['No dash here', '']);
  for (const k of ['fighter', 'rogue', 'wizard']) for (const lang of ['ko', 'en']) {
    const [head, tail] = g.run(`roadParts(CLASS_ROADS.${k}.${lang})`);
    assert.ok(head.length > 0 && head.length <= 16 && tail.startsWith(' — '), `${k}/${lang} splits into a short name and an explanation`);
  }
  assert.match(html, /@media \(max-width: 700px\) \{[\s\S]*?\.crpg \.card \.roadMore \{ display:none; \}/);
});

test('the Returned Letter paper has no dot decoration that reads like a bullet before its label', () => {
  assert.doesNotMatch(html, /\.crpg \.or-paper::before \{/);
});
