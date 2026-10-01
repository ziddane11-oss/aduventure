const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
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

// Use the shipped render and click handlers, including the legacy v1 save's
// Continue button. Effects/layout are deliberately out of scope for this test.
function game({flags = [], lore = [], lang = 'en', sceneKey = 'confront', classKey = 'fighter', ruleKey = 'srd20', success = true} = {}) {
  const states = [], intervals = [];
  let index = 0;
  const data = new Map([
    ['aduventure_lang', JSON.stringify(lang)],
    ['aduventure_lore', JSON.stringify(lore)]
  ]);
  const ctx = vm.createContext({
    console, Date, Math: Object.assign(Object.create(Math), {random: () => success ? 0.999 : 0}),
    setTimeout: () => 0, clearTimeout() {},
    setInterval: fn => intervals.push(fn) - 1,
    clearInterval: id => intervals[id] = null,
    window: {addEventListener() {}}, document: {documentElement: {}},
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
      useEffect() {}
    }
  });
  vm.runInContext(app, ctx);
  data.set('aduventure_save', JSON.stringify({
    v: 1, sceneKey, flags, ruleKey, fate: 0, specialLeft: 2, breathLeft: 1, tutSeen: true,
    pc: {...vm.runInContext(`CLASSES[${JSON.stringify(classKey)}]`, ctx), classKey, name: 'QA', hp: 8},
    stats: {rolls: 0, success: 0}
  }));
  const render = () => { index = 0; return vm.runInContext('CRPG()', ctx); };
  nodes(render()).find(node => node.props.className === 'continueBtn').props.onClick();
  return {
    render,
    run: code => vm.runInContext(code, ctx),
    finishRoll() {
      for (let tick = 0; tick < 12 && intervals.some(Boolean); tick++) {
        intervals.forEach(fn => fn && fn());
      }
      assert.equal(intervals.some(Boolean), false, 'The dice animation and resolution completed');
    }
  };
}
function choices(tree) {
  return nodes(tree).filter(node => node.type === 'button' && node.props.className === 'choice');
}

for (const lang of ['ko', 'en']) {
  test(`${lang}: saved confrontation reveals only earned evidence/grip choices, not remembered lore`, () => {
    for (const flags of [[], ['ledger'], ['grip'], ['ledger', 'grip'], ['ren_tip']]) {
      const g = game({flags, lang, lore: ['ledger']});
      const tree = g.render();
      const buttons = choices(tree).map(text);
      for (const flag of ['ledger', 'grip', 'ren_tip']) {
        const label = g.run(`SCENES.confront.choices.find(choice => choice.echoReq === '${flag}').label.${lang}`);
        assert.equal(buttons.some(value => value.startsWith(label)), flags.includes(flag));
        const echo = g.run(`ECHOES.confront.find(entry => entry.req === '${flag}').text.${lang}`);
        assert.equal(text(tree).includes(echo), flags.includes(flag), 'The matching causal reminder is shown');
      }
      assert.equal(buttons.length, 2 + flags.length, 'The two original choices remain available');
    }
  });
  for (const flag of ['ledger', 'grip']) {
    for (const success of [true, false]) {
      test(`${lang}: ${flag} choice resolves to ${success ? 'peaceful ending' : 'Scully combat'} through the real click handler`, () => {
        const g = game({lang, flags: [flag], success});
        const label = g.run(`SCENES.confront.choices.find(choice => choice.echoReq === '${flag}').label.${lang}`);
        choices(g.render()).find(node => text(node).startsWith(label)).props.onClick();
        g.finishRoll();
        const tree = g.render();
        assert.equal(nodes(tree).some(node => node.props.className === 'scene epi'), success);
        assert.equal(nodes(tree).some(node => node.props.className === 'combat'), !success);
        if (success) {
          assert.ok(text(tree).includes(lang === 'ko' ? '스컬리는 떠났다.' : 'Scully is gone.'));
          if (flag === 'ledger') assert.ok(text(tree).includes(lang === 'ko' ? '품속의 장부' : 'The ledger in your coat'));
        } else {
          assert.ok(text(tree).includes(g.run(`ENEMIES.smuggler.name.${lang}`)));
        }
      });
    }
  }
}

for (const ruleKey of ['srd20', 'simple2d6']) {
  for (const classKey of ['fighter', 'rogue', 'wizard']) {
    test(`${ruleKey} ${classKey}: disruption UI uses the trained ability and shares its translated label`, () => {
      for (const lang of ['ko', 'en']) {
        const g = game({ruleKey, classKey, lang, sceneKey: 'stairs'});
        const fightLabel = g.run(`SCENES.stairs.choices.find(choice => !choice.check).label.${lang}`);
        choices(g.render()).find(node => text(node).startsWith(fightLabel)).props.onClick();
        const label = g.run(`LOOTER_DISRUPTS.${classKey}.label.${lang}`);
        const button = choices(g.render()).find(node => text(node).startsWith(label));
        assert.ok(button, 'The class-specific action is rendered');
        // All three trained primary abilities have +5 (d20) or +3 (2d6).
        assert.ok(text(button).includes(ruleKey === 'srd20' ? '70%' : '92%'));
        const skill = {fighter: 'athletics', rogue: 'stealth', wizard: 'arcana'}[classKey];
        assert.ok(text(button).includes(g.run(`SKILL_NAMES.${skill}.${lang}`)));
        assert.ok(text(button).includes(g.run(`UI.disruptRisk.${lang}`)));
      }
    });
  }
}
