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
  vm.runInContext(between('const SRD20 =', 'const SCENE_TITLES ='), ctx);
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

for (const [ruleKey, successRolls, failRolls] of [
  // Boundary success/failure with the hero's trained primary ability (+5 / +3).
  ['srd20', [7], [6]],
  ['simple2d6', [2, 2], [1, 2]]
]) {
  for (const [classKey, ability, skill, successPhrase, failPhrase] of [
    ['fighter', 'STR', 'athletics', 'twist his hook-arm', 'lose your balance'],
    ['rogue', 'DEX', 'stealth', 'slip out of sight', 'blind spot'],
    ['wizard', 'INT', 'arcana', 'quick spell', 'binding spell']
  ]) {
    test(`${ruleKey} ${classKey}: trained disruption cancels attacks and healing without spending a special`, () => {
      for (const intent of ['slash', 'feint']) {
        const game = battle(ruleKey, 'looter', intent, classKey);
        game.run('enemy.hp = 12; guardBonus = 4');
        const hp = game.run('pc.hp');
        game.run('looterAction("disrupt")', [...successRolls, 3, 1]);
        assert.equal(game.run('checkArgs.ability'), ability);
        assert.equal(game.run('checkArgs.skill'), skill);
        assert.equal(game.run('checkArgs.dc'), 12);
        assert.equal(game.run('enemy.hp'), 9, 'Exactly 1d6 damage, no riposte added or enemy healing');
        assert.equal(game.run('pc.hp'), hp, 'The telegraphed attack is cancelled');
        assert.equal(game.run('guardBonus'), 0, 'Attempting disruption consumes an existing riposte');
        assert.equal(game.run('specialLeft'), 2, 'Disruption does not spend the limited chapter specials');
        assert.equal(game.run('disruptReady'), false, 'Another action is required before repeating disruption');
        assert.equal(game.run('stats.success'), 1);
        assert.ok(game.run('clog[0].t.en').includes(successPhrase));
        assert.equal(game.run('clog.some(entry => entry.who === "foe")'), false);
      }
    });
    test(`${ruleKey} ${classKey}: failed disruption keeps extra damage and consumes riposte`, () => {
      const game = battle(ruleKey, 'looter', 'slash', classKey);
      game.run('guardBonus = 4');
      const hp = game.run('pc.hp');
      game.run('looterAction("disrupt")', [...failRolls, 2, 1]);
      assert.equal(game.run('pc.hp'), hp - 4, 'round((2 + d3(2) - 1) × 1.3) = 4');
      assert.equal(game.run('enemy.hp'), 16);
      assert.equal(game.run('guardBonus'), 0);
      assert.equal(game.run('stats.success'), 0);
      assert.equal(game.run('specialLeft'), 2);
      assert.equal(game.run('disruptReady'), false, 'A failed attempt also requires another action');
      assert.ok(game.run('clog[0].t.en').includes(failPhrase));
      assert.equal(game.run('clog.filter(entry => entry.who === "foe").length'), 1);
    });
  }
}

test('Ren: a repeated disruption is ignored until another real action resolves', () => {
  const game = battle('srd20', 'looter', 'slash');
  game.run('looterAction("disrupt")', [7, 3, 1]);
  const before = game.run('JSON.stringify({pc, enemy, stats, clog, enemyIntent})');
  game.run('looterAction("disrupt")');
  assert.equal(game.run('JSON.stringify({pc, enemy, stats, clog, enemyIntent})'), before,
    'Unavailable actions do not roll, damage, log or advance the enemy');
  game.run('looterAction("guard")', [1, 1]);
  assert.equal(game.run('disruptReady'), true);
  game.run('looterAction("disrupt")', [7, 3, 1]);
  assert.equal(game.run('enemy.hp'), 10);
  assert.equal(game.run('disruptReady'), false);
});

test('unavailable combat resources cannot advance the turn or recharge disruption', () => {
  const ren = battle('srd20', 'looter');
  ren.run('disruptReady = false; looterAction("trap")');
  assert.equal(ren.run('disruptReady'), false, 'An undiscovered trap is not an alternate action');
  ren.run('flags = ["sawTrap"]; trapUsed = true; looterAction("trap")');
  assert.equal(ren.run('clog.length'), 0, 'A spent trap does not advance combat');
  const regular = battle('srd20');
  regular.run('specialLeft = 0; breathLeft = 0; guardBonus = 4; combatAction("special"); combatAction("breath")');
  assert.equal(regular.run('clog.length'), 0);
  assert.equal(regular.run('guardBonus'), 4, 'Rejected actions do not spend a prepared riposte');
});

for (const [ruleKey, defendRolls, attackRolls, missRolls, expectedDamage] of [
  ['srd20', [1], [15, 1, 1], [1, 1], 8],
  ['simple2d6', [1, 1], [5, 5, 1, 1, 1], [1, 1, 1, 1], 5]
]) {
  test(`${ruleKey}: repeated defense grants one +4 riposte, consumed by the next basic attack`, () => {
    const game = battle(ruleKey);
    game.run('combatAction("defend")', defendRolls);
    game.run('combatAction("defend")', defendRolls);
    assert.equal(game.run('guardBonus'), 4, 'Defending twice does not stack bonuses');
    game.run('combatAction("attack")', attackRolls);
    assert.equal(game.run('enemy.hp'), 11 - expectedDamage);
    assert.equal(game.run('guardBonus'), 0);
    assert.ok(game.run('clog.some(entry => entry.t.en.includes("+4 defensive riposte"))'));
  });
  test(`${ruleKey}: a missed basic attack spends the prepared riposte without bonus damage`, () => {
    const game = battle(ruleKey);
    game.run('combatAction("defend")', defendRolls);
    game.run('combatAction("attack")', missRolls);
    assert.equal(game.run('enemy.hp'), 11);
    assert.equal(game.run('guardBonus'), 0);
  });
  test(`${ruleKey}: special attacks and healing discard a defensive riposte`, () => {
    for (const action of ['special', 'breath']) {
      const game = battle(ruleKey, 'smuggler', 'hook', 'wizard');
      game.run('combatAction("defend")', defendRolls);
      game.run(`combatAction("${action}")`, [1, ...defendRolls]);
      assert.equal(game.run('guardBonus'), 0);
      assert.equal(game.run('enemy.hp'), action === 'special' ? 8 : 11,
        'Magic Missile keeps its own 1d8+2 damage and never receives the +4');
    }
  });
}

for (const [ruleKey, guardRolls, hitRolls, attackRolls] of [
  // Scully vs Fighter: d20+4 vs AC 16/20; 2d6+1 vs target 12/14.
  ['srd20', [12], [16, 4], [1, 12, 4]],
  ['simple2d6', [5, 6], [6, 6, 4], [1, 1, 5, 6, 4]]
]) {
  test(`${ruleKey}: defending turns a boundary hit into a miss for one attack`, () => {
    const game = battle(ruleKey);
    game.run('combatAction("defend")', guardRolls);
    assert.equal(game.run('pc.hp'), 12);
    assert.equal(game.run('pc.ac'), 16, 'Base AC must not be mutated');
    game.run('combatAction("attack")', attackRolls);
    assert.ok(game.run('pc.hp') < 12, 'The next normal action no longer receives the AC bonus');
  });
  test(`${ruleKey}: a hit while defending still deals normal damage`, () => {
    const game = battle(ruleKey);
    const expected = game.run('rules.attack({attacker: ENEMIES.smuggler, defender: {...pc, ac: pc.ac + 4}}).damage', hitRolls);
    game.run('combatAction("defend")', hitRolls);
    assert.ok(expected > 0);
    assert.equal(game.run('pc.hp'), 12 - expected);
  });
}
for (const [intent, roll, damage] of [['hook', 3, 2], ['slash', 3, 2]]) {
  test(`Ren: parry applies the ${intent} multiplier and grants one riposte`, () => {
    const game = battle('srd20', 'looter', intent);
    game.run('looterAction("guard")', [roll, 1]);
    assert.equal(game.run('pc.hp'), 12 - damage);
    assert.equal(game.run('guardBonus'), 4);
    const before = game.run('enemy.hp');
    game.run('looterAction("strike")', [15, 1, 1, 1]);
    assert.equal(game.run('enemy.hp'), before - 8, '1d8(1) + STR(3) + riposte(4)');
    assert.equal(game.run('guardBonus'), 0);
  });
}
