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
  // Expose the real transition handlers only inside this test VM, so temporary
  // combat state can be checked across new fights, restarts and legacy saves.
  vm.runInContext(app.replace('  const pct = choice =>', `
    globalThis.testTransitions = {goto, restart, continueGame};
    globalThis.testCombatState = {guardBonus, disruptReady};
    const pct = choice =>`), ctx);
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
    transition: (name, ...args) => ctx.testTransitions[name](...args),
    combatState: () => ctx.testCombatState,
    finishRoll() {
      for (let tick = 0; tick < 12 && intervals.some(Boolean); tick++) {
        intervals.forEach(fn => fn && fn());
      }
      assert.equal(intervals.some(Boolean), false, 'The dice animation and resolution completed');
    }
  };
}

test('changing language during combat translates the existing battle-start log', () => {
  const g = game({lang: 'ko', sceneKey: 'stairs'});
  g.transition('goto', 'combat');
  let tree = g.render();
  assert.ok(text(tree).includes('⚔ 전투 개시 —'));
  nodes(tree).find(node => node.props['aria-label'] === 'language').props.onClick();
  tree = g.render();
  assert.ok(text(tree).includes("⚔ Battle — 'Hook' Ren"));
  assert.ok(!text(tree).includes('⚔ 전투 개시 —'));
  nodes(tree).find(node => node.props['aria-label'] === 'language').props.onClick();
  assert.ok(text(g.render()).includes('⚔ 전투 개시 —'));
});

for (const lang of ['ko', 'en']) {
  test(`${lang}: a spent disruption visibly locks and another action unlocks it`, () => {
    const g = game({lang, sceneKey: 'stairs'});
    g.transition('goto', 'combat');
    const label = g.run(`LOOTER_DISRUPTS.fighter.label.${lang}`);
    const disruption = () => choices(g.render()).find(node => text(node).startsWith(label));
    assert.equal(disruption().props.disabled, false);
    assert.ok(text(disruption()).includes(g.run(`UI.disruptHelp.${lang}`)));
    disruption().props.onClick();
    assert.equal(disruption().props.disabled, true);
    assert.ok(text(disruption()).includes(g.run(`UI.disruptWait.${lang}`)));
    const parryTag = g.run(`UI.parryTag.${lang}`);
    choices(g.render()).find(node => text(node).includes(parryTag)).props.onClick();
    assert.equal(disruption().props.disabled, false);
  });
  test(`${lang}: general defense shows its cost and highlights the prepared basic attack`, () => {
    const g = game({lang, sceneKey: 'confront'});
    g.transition('goto', 'combat2');
    g.run('Math.random = () => 0'); // Enemy misses while the hero prepares a riposte.
    const tag = resolvedUI(g, 'defendTag', lang, {riposte: 4});
    const defense = choices(g.render()).find(node => text(node).includes(tag));
    assert.ok(text(defense).includes(resolvedUI(g, 'defendHelp', lang, {riposte: 4})));
    defense.props.onClick();
    assert.ok(choices(g.render()).some(node => text(node).includes(resolvedUI(g, 'riposteReady', lang, {riposte: 4}))));
  });
}

for (const [transition, args] of [['goto', ['combat2']], ['restart', ['intro2']], ['continueGame', []]]) {
  test(`${transition}: combat preparation resets without changing the legacy save format`, () => {
    for (const prepare of ['disrupt', 'guard']) {
      const g = game({sceneKey: 'stairs'});
      g.transition('goto', 'combat');
      const label = prepare === 'disrupt' ? g.run('LOOTER_DISRUPTS.fighter.label.en') : '🛡 Brace to parry';
      choices(g.render()).find(node => text(node).startsWith(label)).props.onClick();
      g.render();
      if (prepare === 'disrupt') assert.equal(g.combatState().disruptReady, false);
      else assert.equal(g.combatState().guardBonus, 4);
      g.transition(transition, ...args);
      g.render();
      assert.equal(g.combatState().disruptReady, true);
      assert.equal(g.combatState().guardBonus, 0);
    }
  });
}
function resolvedUI(g, key, lang, values = {}) {
  return g.run(`UI.${key}.${lang}`).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? `{${name}}`);
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
        const damage = g.run(`RULE_SYSTEMS.${ruleKey}.damageRange({die: 6}).join('–')`);
        assert.ok(text(button).includes(resolvedUI(g, 'disruptRisk', lang, {damage})));
      }
    });
  }
}

for (const ruleKey of ['srd20', 'simple2d6']) {
  for (const lang of ['ko', 'en']) {
    test(`${ruleKey} ${lang}: combat controls display their actual damage, healing and riposte values`, () => {
      const riposte = ruleKey === 'srd20' ? 4 : 2;
      for (const classKey of ['fighter', 'wizard']) {
        const g = game({ruleKey, lang, classKey, sceneKey: 'confront'});
        g.transition('goto', 'combat2');
        const buttons = choices(g.render());
        const normalRange = g.run(`(() => {const rule = RULE_SYSTEMS.${ruleKey}, actor = CLASSES.${classKey}; return rule.damageRange({die: actor.weapon.die, bonus: Math.max(0, rule.abilityMod(actor.abilities[actor.weapon.ability]))}).join('–');})()`);
        assert.ok(text(buttons[0]).includes(normalRange), 'Basic attack range includes its ability modifier and rule scaling');
        const specialRange = classKey === 'wizard'
          ? (ruleKey === 'srd20' ? '3–10' : '2–5')
          : (ruleKey === 'srd20' ? '1–6' : '1–3');
        assert.ok(text(buttons[1]).includes(specialRange), 'Special damage or extra damage agrees with the rule');
        assert.ok(text(buttons[2]).includes(resolvedUI(g, 'defendHelp', lang, {riposte})));
        assert.ok(text(buttons[2]).includes(`+${riposte}`));
        assert.ok(text(buttons[3]).includes(ruleKey === 'srd20' ? '1–4' : '1–2'), 'Catch breath shows scaled recovery');
        assert.doesNotMatch(buttons.map(text).join(' '), /\{(?:damage|heal|riposte)\}/, 'No unresolved UI placeholders');
        g.run('Math.random = () => 0');
        buttons[2].props.onClick();
        const prepared = choices(g.render())[0];
        assert.equal(g.combatState().guardBonus, riposte);
        assert.ok(text(prepared).includes(resolvedUI(g, 'riposteReady', lang, {riposte})));
      }
      const ren = game({ruleKey, lang, sceneKey: 'stairs'});
      ren.transition('goto', 'combat');
      const buttons = choices(ren.render());
      assert.ok(text(buttons[1]).includes(resolvedUI(ren, 'parryHelp', lang, {riposte})));
      assert.ok(text(buttons[1]).includes(`+${riposte}`));
      assert.ok(text(buttons[2]).includes(ruleKey === 'srd20' ? '1–6' : '1–3'), 'Ren disruption shows scaled damage');
    });
  }
}
