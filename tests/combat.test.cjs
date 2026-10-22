const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

// Execute the shipped rules and action handlers, with deterministic dice and
// React state setters replaced by in-memory state. No network or browser needed.
const source = fs.readFileSync(process.env.GAME_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');
function between(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Source section exists: ${start}`);
  return source.slice(from, to);
}
function battle(ruleKey, enemyKey = 'smuggler', intent = 'hook', classKey = 'fighter') {
  const dice = [];
  const ctx = vm.createContext({
    Math, bi: (ko, en) => ({ko, en}),
    d(sides) {
      assert.ok(dice.length, 'Every die roll must be specified');
      const value = dice.shift();
      assert.ok(value >= 1 && value <= sides, `d${sides}: ${value}`);
      return value;
    }
  });
  vm.runInContext(between('const wname =', '/* ---------- 다국어 UI') + between('const SRD20 =', 'const SCENE_TITLES ='), ctx);
  vm.runInContext(`
    let ruleKey = ${JSON.stringify(ruleKey)};
    let checkArgs;
    let rules = {...RULE_SYSTEMS[ruleKey], check(args) {
      checkArgs = args;
      return RULE_SYSTEMS[ruleKey].check(args);
    }};
    let pc = {...CLASSES[${JSON.stringify(classKey)}], classKey: ${JSON.stringify(classKey)}, name: 'QA', hp: CLASSES[${JSON.stringify(classKey)}].maxHp};
    let scene = {enemy: ${JSON.stringify(enemyKey)}};
    let enemy = {...ENEMIES[scene.enemy], hp: ENEMIES[scene.enemy].maxHp};
    let enemyIntent = ${JSON.stringify(intent)}, guardBonus = 0, trapUsed = false, disruptReady = true;
    let specialLeft = 2, breathLeft = 1, stats = {rolls: 0, success: 0}, clog = [], flags = [];
    const lang = 'en', tx = value => value.en || value;
    const SFX = {good() {}, bad() {}};
    const recordDecision = () => true;
    const setLastResult = () => {};
    const setPc = value => pc = value;
    const setEnemy = value => enemy = value;
    const setClog = fn => clog = fn(clog);
    const setStats = fn => stats = fn(stats);
    const setSpecialLeft = fn => specialLeft = fn(specialLeft);
    const setBreathLeft = value => breathLeft = value;
    const setEnemyIntent = value => enemyIntent = value;
    const setGuardBonus = value => guardBonus = value;
    const setTrapUsed = value => trapUsed = value;
    const setDisruptReady = value => disruptReady = value;
    ${between('  function looterAction(action)', '  function restart(')}
  `, ctx);
  return {
    run(code, rolls = []) {
      dice.push(...rolls);
      const result = vm.runInContext(code, ctx);
      assert.equal(dice.length, 0, 'No unused dice');
      return result;
    }
  };
}

const RULE_CASES = [
  {key: 'srd20', success: [7], failure: [6], hit: [15], max: [20], miss: [1], scale: n => n, riposte: 4},
  {key: 'simple2d6', success: [2, 2], failure: [1, 2], hit: [5, 5], max: [6, 6], miss: [1, 1], scale: n => Math.ceil(n / 2), riposte: 2}
];

for (const r of RULE_CASES) {
  const {key: ruleKey, scale} = r;
  for (const [classKey, ability, skill, successPhrase, failPhrase] of [
    ['fighter', 'STR', 'athletics', 'twist his hook-arm', 'lose your balance'],
    ['rogue', 'DEX', 'stealth', 'slip out of sight', 'blind spot'],
    ['wizard', 'INT', 'arcana', 'quick spell', 'binding spell']
  ]) {
    test(`${ruleKey} ${classKey}: disruption uses the trained check and scaled damage, cancelling an attack or recovery`, () => {
      for (const intent of ['slash', 'feint']) {
        const game = battle(ruleKey, 'looter', intent, classKey);
        game.run('enemy.hp = 12; guardBonus = 4');
        const hp = game.run('pc.hp');
        game.run('looterAction("disrupt")', [...r.success, 3, 1]);
        assert.equal(game.run('checkArgs.ability'), ability);
        assert.equal(game.run('checkArgs.skill'), skill);
        assert.equal(game.run('checkArgs.dc'), 12);
        assert.equal(game.run('enemy.hp'), 12 - scale(3), 'Only rule-scaled disruption damage; no riposte or recovery');
        assert.equal(game.run('pc.hp'), hp, 'The telegraphed attack is cancelled');
        assert.equal(game.run('guardBonus'), 0);
        assert.equal(game.run('specialLeft'), 2, 'Disruption does not spend chapter specials');
        assert.equal(game.run('disruptReady'), false);
        assert.equal(game.run('stats.success'), 1);
        assert.ok(game.run('clog[0].t.en').includes(successPhrase));
        assert.equal(game.run('clog.some(entry => entry.who === "foe")'), false);
      }
    });
    test(`${ruleKey} ${classKey}: failed disruption is vulnerable only if Ren hits AC`, () => {
      for (const hit of [true, false]) {
        const game = battle(ruleKey, 'looter', 'slash', classKey);
        game.run('guardBonus = 4');
        const hp = game.run('pc.hp'), enemyHp = game.run('enemy.hp');
        game.run('looterAction("disrupt")', [...r.failure, ...(hit ? [...r.max, 2] : r.miss), 1]);
        assert.equal(game.run('pc.hp'), hp - (hit ? Math.round(scale(3) * 1.3) : 0));
        assert.equal(game.run('enemy.hp'), enemyHp);
        assert.equal(game.run('guardBonus'), 0);
        assert.equal(game.run('stats.success'), 0);
        assert.equal(game.run('specialLeft'), 2);
        assert.equal(game.run('disruptReady'), false);
        assert.ok(game.run('clog[0].t.en').includes(failPhrase));
        const enemyLog = game.run('clog.filter(entry => entry.who === "foe")');
        assert.equal(enemyLog.length, 1);
        assert.ok(enemyLog[0].t.en.includes(hit ? 'caught in the open' : 'miss'));
      }
    });
  }

  test(`${ruleKey}: Ren must hit armor before dealing his intent damage`, () => {
    // A middle roll hits the rogue's armor but misses the fighter's. This also
    // checks that Ren's custom profile does not bypass the attack rule.
    const boundary = ruleKey === 'srd20' ? [10] : [3, 3];
    for (const [classKey, hit] of [['fighter', false], ['rogue', true]]) {
      const game = battle(ruleKey, 'looter', 'slash', classKey);
      const hp = game.run('pc.hp');
      game.run('looterAction("strike")', [...r.miss, ...boundary, ...(hit ? [2] : []), 1]);
      assert.equal(game.run('pc.hp'), hp - (hit ? scale(3) : 0));
      assert.ok(game.run('clog[1].t.en').includes(hit ? 'damage' : 'miss'));
    }
  });
  test(`${ruleKey}: Ren's trap uses rule-scaled damage and cancels his move`, () => {
    const game = battle(ruleKey, 'looter', 'hook');
    game.run('flags = ["sawTrap"]; guardBonus = 4');
    const before = game.run('enemy.hp');
    game.run('looterAction("trap")', [4, 1]);
    assert.equal(game.run('enemy.hp'), before - scale(6));
    assert.equal(game.run('pc.hp'), 12);
    assert.equal(game.run('guardBonus'), 0);
    assert.equal(game.run('trapUsed'), true);
    const after = game.run('JSON.stringify({pc, enemy, stats, clog, enemyIntent})');
    game.run('looterAction("trap")');
    assert.equal(game.run('JSON.stringify({pc, enemy, stats, clog, enemyIntent})'), after);
  });
  test(`${ruleKey}: Ren recovery is scaled and capped at maximum HP`, () => {
    for (const hp of [5, 13]) {
      const game = battle(ruleKey, 'looter', 'feint');
      game.run(`enemy.hp = ${hp}`);
      const maximum = game.run('ENEMIES.looter.maxHp');
      game.run('looterAction("guard")', [3, 1]);
      assert.equal(game.run('enemy.hp'), Math.min(maximum, hp + scale(4)));
    }
  });
  test(`${ruleKey}: repeating disruption is ignored until another real action resolves`, () => {
    const game = battle(ruleKey, 'looter', 'slash');
    game.run('looterAction("disrupt")', [...r.success, 3, 1]);
    const before = game.run('JSON.stringify({pc, enemy, stats, clog, enemyIntent})');
    game.run('looterAction("disrupt")');
    assert.equal(game.run('JSON.stringify({pc, enemy, stats, clog, enemyIntent})'), before);
    game.run('looterAction("guard")', [...r.miss, 1]);
    assert.equal(game.run('disruptReady'), true);
    const hp = game.run('enemy.hp');
    game.run('looterAction("disrupt")', [...r.success, 3, 1]);
    assert.equal(game.run('enemy.hp'), hp - scale(3));
    assert.equal(game.run('disruptReady'), false);
  });

  test(`${ruleKey}: repeated general defense grants one scaled riposte, consumed by a basic hit`, () => {
    const game = battle(ruleKey);
    game.run('combatAction("defend")', r.miss);
    game.run('combatAction("defend")', r.miss);
    assert.equal(game.run('guardBonus'), r.riposte, 'No stacking');
    const ordinary = ruleKey === 'srd20' ? 4 : 2; // d8(1) + positive ability modifier, then rule scale.
    game.run('combatAction("attack")', [...r.hit, 1, ...r.miss]);
    assert.equal(game.run('enemy.hp'), 11 - ordinary - r.riposte);
    assert.equal(game.run('guardBonus'), 0);
    assert.ok(game.run('clog.some(entry => entry.t.en.includes("+' + r.riposte + ' defensive riposte"))'));
  });
  test(`${ruleKey}: a missed basic attack spends the prepared riposte without bonus damage`, () => {
    const game = battle(ruleKey);
    game.run('combatAction("defend")', r.miss);
    game.run('combatAction("attack")', [...r.miss, ...r.miss]);
    assert.equal(game.run('enemy.hp'), 11);
    assert.equal(game.run('guardBonus'), 0);
  });
  test(`${ruleKey}: Magic Missile and recovery use the rules and discard a prepared riposte`, () => {
    for (const action of ['special', 'breath']) {
      const game = battle(ruleKey, 'smuggler', 'hook', 'wizard');
      game.run('pc.hp = 2');
      game.run('combatAction("defend")', r.miss);
      game.run(`combatAction("${action}")`, [4, ...r.miss]);
      assert.equal(game.run('guardBonus'), 0);
      assert.equal(game.run('enemy.hp'), action === 'special' ? 11 - scale(6) : 11);
      assert.equal(game.run('pc.hp'), action === 'breath' ? 2 + scale(4) : 2);
      assert.equal(game.run('specialLeft'), action === 'special' ? 1 : 2);
      assert.equal(game.run('breathLeft'), action === 'breath' ? 0 : 1);
    }
  });
  test(`${ruleKey}: Power Strike scales its extra die and never rolls damage on a miss`, () => {
    for (const hit of [true, false]) {
      const game = battle(ruleKey);
      game.run('combatAction("special")', hit ? [...r.hit, 1, 6, ...r.miss] : [...r.miss, ...r.miss]);
      const damage = hit ? (ruleKey === 'srd20' ? 4 : 2) + scale(6) : 0;
      assert.equal(game.run('enemy.hp'), 11 - damage);
      assert.equal(game.run('specialLeft'), 1);
    }
  });
  test(`${ruleKey}: general defense changes the one-turn hit boundary, not base armor or damage`, () => {
    const boundary = ruleKey === 'srd20' ? [12] : [4, 4];
    const game = battle(ruleKey);
    game.run('combatAction("defend")', boundary);
    assert.equal(game.run('pc.hp'), 12);
    assert.equal(game.run('pc.ac'), 16);
    game.run('combatAction("attack")', [...r.miss, ...boundary, 4]);
    assert.ok(game.run('pc.hp') < 12, 'The next normal action loses the defense AC bonus');
    const defended = battle(ruleKey);
    const maximumDamageDice = ruleKey === 'srd20' ? [...r.max, 4, 4] : [...r.max, 4];
    const expected = defended.run('rules.attack({attacker: ENEMIES.smuggler, defender: {...pc, ac: pc.ac + 4}}).damage', maximumDamageDice);
    defended.run('combatAction("defend")', maximumDamageDice);
    assert.equal(defended.run('pc.hp'), 12 - expected, 'A hit while defending is not damage reduction');
  });
  for (const [intent, multiplier, rawDamage] of [['hook', 0.2, 8], ['slash', 0.5, 4]]) {
    test(`${ruleKey}: Ren parry reduces ${intent} damage and grants one scaled riposte`, () => {
      const game = battle(ruleKey, 'looter', intent);
      game.run('looterAction("guard")', [...r.max, 3, 1]);
      assert.equal(game.run('pc.hp'), 12 - Math.round(scale(rawDamage) * multiplier));
      assert.equal(game.run('guardBonus'), r.riposte);
      game.run('looterAction("guard")', [...r.miss, 1]);
      assert.equal(game.run('guardBonus'), r.riposte, 'Repeated parries do not stack');
      const before = game.run('enemy.hp');
      game.run('looterAction("strike")', [...r.hit, 1, ...r.miss, 1]);
      assert.equal(game.run('enemy.hp'), before - (ruleKey === 'srd20' ? 4 : 2) - r.riposte);
      assert.equal(game.run('guardBonus'), 0);
    });
  }
}

test('unavailable combat resources cannot advance the turn or recharge disruption', () => {
  const ren = battle('srd20', 'looter');
  ren.run('disruptReady = false; looterAction("trap")');
  assert.equal(ren.run('disruptReady'), false);
  ren.run('flags = ["sawTrap"]; trapUsed = true; looterAction("trap")');
  assert.equal(ren.run('clog.length'), 0);
  const regular = battle('srd20');
  regular.run('specialLeft = 0; breathLeft = 0; guardBonus = 4; combatAction("special"); combatAction("breath")');
  assert.equal(regular.run('clog.length'), 0);
  assert.equal(regular.run('guardBonus'), 4);
});
