// pt30 — 선택지가 4개를 넘으면 특별한 길·안 가 본 길 4개만 먼저, 나머지는 「다른 방법 n개 더」.
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

const choiceBtns = tree => nodes(tree).filter(n => n.type === 'button' && /^choice( |$)/.test(n.props.className));

test('confront with every key in hand shows four ways first, the rest folded', () => {
  const g = game({sceneKey: 'confront', flags: ['ledger', 'grip', 'ren_tip', 'sabotage', 'leadBern']});
  const shown = choiceBtns(g.render()).map(text);
  assert.equal(shown.length, 4);
  assert.ok(shown.some(t => /\[Receipt\]/.test(t)), 'the receipt promised at the morning lead is never folded');
  const plain = [...g.run('SCENES.confront.choices')].filter(c => !c.echoReq && !c.loreReq && !c.classOnly).map(c => c.label.en);
  assert.equal(shown.filter(t => plain.some(label => t.startsWith(label))).length, 1, 'one ordinary way stays in view');
  assert.ok(shown.some(t => /\[Persuade\]/.test(t)), 'and it is the talking one: ' + shown.join(' | '));
  const more = nodes(g.render()).find(n => n.props.className === 'moreChoices');
  assert.match(text(more), /3 more ways/);
  assert.equal(g.run('UI.moreChoice1.en'), '▾ 1 more way');
  more.props.onClick();
  assert.equal(choiceBtns(g.render()).length, 7);
  assert.equal(nodes(g.render()).find(n => n.props.className === 'moreChoices'), undefined);
});

test('four or fewer ways stay visible; lead hubs use the same cap', () => {
  const few = game({sceneKey: 'confront'});
  assert.equal(nodes(few.render()).find(n => n.props.className === 'moreChoices'), undefined);
  const hub = game({sceneKey: 'dawn2', flags: ['sabotage', 'ledger', 'caughtRen', 'peaceful']});
  assert.equal(choiceBtns(hub.render()).length, 4);
  const more = nodes(hub.render()).find(n => n.props.className === 'moreChoices');
  assert.ok(more); more.props.onClick();
  assert.equal(choiceBtns(hub.render()).length, 5);
});

test('the fold label speaks both languages', () => {
  const g = game();
  const t = JSON.parse(g.run('JSON.stringify(UI.moreChoices)'));
  assert.ok(HANGUL.test(t.ko) && !HANGUL.test(t.en));
});
