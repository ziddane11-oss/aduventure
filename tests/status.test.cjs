const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const app = scripts.at(-1).split('ReactDOM.createRoot')[0];
function harness() {
  const states = [];
  let index = 0;
  const data = new Map([
    ['aduventure_lang', '"ko"'],
    ['aduventure_badges', '["1pf"]'],
    ['aduventure_records', '{"1pf":{"rate":50,"rolls":2,"success":1}}']
  ]);
  const ctx = vm.createContext({
    console, Date, Math, setTimeout, clearTimeout,
    window: {addEventListener() {}},
    document: {documentElement: {}},
    fetch: async () => { throw new Error('Network disabled in unit tests'); },
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
      // These tests exercise render values and event handlers, not DOM effects.
      useEffect() {}
    }
  });
  vm.runInContext(app, ctx);
  return {
    data,
    run: code => vm.runInContext(code, ctx),
    render() { index = 0; return vm.runInContext('CRPG()', ctx); }
  };
}
function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...node.children.flatMap(nodes)];
}
test('all embedded scripts parse', () => {
  scripts.forEach(script => new vm.Script(script));
});
test('health labels, accessible values and bar width agree at full, half and zero HP', () => {
  const game = harness();
  for (const lang of ['ko', 'en']) {
    for (const hp of [8, 4, 0]) {
      const tree = game.run(`HealthMeter({hp:${hp}, maxHp:8, ui:key=>UI[key].${lang}})`);
      const all = nodes(tree);
      const bar = all.find(node => node.props.role === 'progressbar');
      assert.equal(bar.props['aria-valuenow'], hp);
      assert.equal(bar.props['aria-valuemax'], 8);
      assert.equal(bar.props['aria-valuetext'], `${hp} / 8`);
      assert.ok(bar.props['aria-label'].includes(lang === 'ko' ? '체력' : 'Health'));
      assert.equal(bar.children[0].props.style.width, `${hp / 8 * 100}%`);
    }
  }
});
test('language toggle keeps the active hero and existing local records', () => {
  const game = harness();
  const beforeRecords = game.data.get('aduventure_records');
  let tree = game.render();
  nodes(tree).find(node => node.props.className === 'card').props.onClick();
  tree = game.render();
  const healthBefore = nodes(tree).find(node => node.type.name === 'HealthMeter').props;
  nodes(tree).find(node => node.props['aria-label'] === 'language').props.onClick();
  tree = game.render();
  const healthAfter = nodes(tree).find(node => node.type.name === 'HealthMeter').props;
  assert.equal(healthAfter.hp, healthBefore.hp);
  assert.equal(healthAfter.maxHp, healthBefore.maxHp);
  assert.equal(healthAfter.ui('health'), 'HP · Health');
  assert.equal(game.data.get('aduventure_lang'), '"en"');
  assert.equal(game.data.get('aduventure_records'), beforeRecords);
  assert.equal(game.data.get('aduventure_badges'), '["1pf"]');
});
