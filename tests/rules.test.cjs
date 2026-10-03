const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(process.env.GAME_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');
const cut = (start, end) => {
  const from = html.indexOf(start), to = html.indexOf(end, from);
  assert.ok(from >= 0 && to > from);
  return html.slice(from, to);
};
function rules(key) {
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
  vm.runInContext(cut('const wname =', '/* ---------- 다국어 UI') + cut('const SRD20 =', 'const SCENE_TITLES =') + `; const rules = RULE_SYSTEMS.${key};`, ctx);
  return (code, rolls = []) => {
    dice.push(...rolls);
    const result = vm.runInContext(code, ctx);
    assert.equal(dice.length, 0, 'No unused dice');
    return result;
  };
}

for (const [key, scale] of [['srd20', n => n], ['simple2d6', n => Math.ceil(n / 2)]]) {
  test(`${key}: damage and recovery use the same scale, and displayed ranges include exact endpoints`, () => {
    const run = rules(key);
    // Disruption, trap, Magic Missile, Power Strike bonus, Ren slash/hook and recovery.
    for (const profile of [{die: 6}, {die: 4, bonus: 2}, {die: 8, bonus: 2}, {die: 3, bonus: 1}, {die: 3, bonus: 5}, {die: 4}]) {
      const p = JSON.stringify(profile), bonus = profile.bonus || 0;
      const expected = [scale(1 + bonus), scale(profile.die + bonus)];
      assert.deepEqual(Array.from(run(`rules.damageRange(${p})`)), expected);
      for (const method of ['rollDamage', 'rollRecovery']) {
        assert.equal(run(`rules.${method}(${p})`, [1]), expected[0]);
        assert.equal(run(`rules.${method}(${p})`, [profile.die]), expected[1]);
      }
    }
    assert.equal(run('rules.scaleEffect(4)'), scale(4));
    assert.equal(run('rules.scaleEffect(0)'), 0);
  });
  test(`${key}: ordinary critical damage follows the rule while a custom intent profile stays bounded`, () => {
    const run = rules(key);
    const attack = 'rules.attack({attacker: CLASSES.fighter, defender: ENEMIES.looter';
    const maximum = key === 'srd20' ? [20] : [6, 6];
    const ordinary = run(`${attack}})`, [...maximum, ...(key === 'srd20' ? [4, 4] : [4])]);
    assert.equal(ordinary.hit, true);
    assert.equal(ordinary.crit, true);
    assert.equal(ordinary.damage, key === 'srd20' ? 11 : 5);
    assert.ok(ordinary.detail.ko.length && ordinary.detail.en.length);
    const intent = run(`${attack}, damageProfile: {die: 3, bonus: 5}})`, [...maximum, 3]);
    assert.equal(intent.hit, true);
    assert.equal(intent.damage, scale(8), 'A natural maximum does not double a telegraphed damage profile');
  });
  test(`${key}: a miss never evaluates the weapon or custom damage profile`, () => {
    const run = rules(key);
    const minimum = key === 'srd20' ? [1] : [1, 1];
    for (const profile of ['', ', damageProfile: {die: 3, bonus: 5}']) {
      const result = run(`rules.attack({attacker: ENEMIES.looter, defender: CLASSES.fighter${profile}})`, minimum);
      assert.equal(result.hit, false);
      assert.equal(result.damage, 0);
    }
  });
}
