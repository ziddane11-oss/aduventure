// pt15 — 렌과의 서사 결투(2박자), 갈림길로 바로 가기, 본 장면 접기, 위치 카드, 상황 효과음.
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
const choices = tree => nodes(tree).filter(n => n.type === 'button' && /^choice/.test(n.props.className || ''));

function game({sceneKey = 'stairs', flags = [], classKey = 'fighter', hp = 12, success = true, lang = 'en', store = {}, fresh = false} = {}) {
  const states = [], intervals = [];
  let index = 0;
  const data = new Map([['aduventure_lang', JSON.stringify(lang)], ...Object.entries(store).map(([k, v]) => [k, JSON.stringify(v)])]);
  const ctx = vm.createContext({
    console, Date, Math: Object.assign(Object.create(Math), {random: () => success ? 0.999 : 0}),
    setTimeout: () => 0, clearTimeout() {},
    setInterval: fn => intervals.push(fn) - 1, clearInterval: id => intervals[id] = null,
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
    globalThis.api = {goto, flags, sceneKey, pc, seenAtRun};
    const pct = choice =>`), ctx);
  const render = () => { index = 0; return vm.runInContext('CRPG()', ctx); };
  if (!fresh) {
    data.set('aduventure_save', JSON.stringify({
      v: 1, sceneKey, flags, ruleKey: 'srd20', fate: 0, specialLeft: 2, breathLeft: 1, tutSeen: true,
      pc: {...vm.runInContext(`CLASSES[${JSON.stringify(classKey)}]`, ctx), classKey, name: 'QA', hp}, stats: {rolls: 0, success: 0}
    }));
    nodes(render()).find(n => n.props.className === 'continueBtn').props.onClick();
  }
  return {
    render, data, run: code => vm.runInContext(code, ctx),
    state: () => { render(); return ctx.api; },
    click(label) {
      const b = choices(render()).find(n => text(n).includes(label));
      assert.ok(b, 'Visible choice: ' + label);
      b.props.onClick();
      for (let t = 0; t < 12 && intervals.some(Boolean); t++) intervals.forEach(fn => fn && fn());
      return render();
    }
  };
}

test('the stairs fight and failed talks now lead to the narrative duel, not the number combat', () => {
  const g = game();
  assert.deepEqual([...g.run(`SCENES.stairs.choices.flatMap(c => [c.goto, c.fail?.goto]).filter(Boolean)`)].sort(), ['duel1', 'duel1', 'duel1', 'duel1'], 'Including the rogue\'s failed lift');
  g.click('[Fight]');
  assert.equal(g.state().sceneKey, 'duel1');
});

test('every duel branch ends at the railing, the lantern room, or the beacon — never a repeated menu', () => {
  const g = game();
  const targets = g.run(`['duel1','duel2'].flatMap(k => SCENES[k].choices.flatMap(c => [c.success, c.fail, c.result].filter(Boolean).map(b => [k, b.goto, b.ifDown || null])))`);
  for (const [scene, to, down] of targets) {
    assert.ok(scene === 'duel1' ? ['duel2', 'top'].includes(to) : ['railing', 'top'].includes(to), scene + ' -> ' + to);
    if (down) assert.equal(down, 'signal');
  }
  assert.ok(g.run(`['duel1','duel2'].every(k => SCENES[k].choices.every(c => c.stake && c.stake.ko && c.stake.en))`), 'Every duel choice states its stake');
});

test('duel beat one: winning the exchange opens an easier finishing move', () => {
  const g = game();
  g.state().goto('duel1');
  g.click('[Athletics] Catch the hook head-on');
  const s = g.state();
  assert.equal(s.sceneKey, 'duel2');
  assert.ok(s.flags.includes('duelEdge'));
  assert.ok(choices(g.render()).some(n => text(n).startsWith('[Athletics] Press the opening')));
  g.click('[Athletics] Press the opening');
  assert.equal(g.state().sceneKey, 'railing');
});

test('only the wizard sees the frost option', () => {
  for (const [cls, seen] of [['fighter', false], ['rogue', false], ['wizard', true]]) {
    const g = game({classKey: cls});
    g.state().goto('duel1');
    assert.equal(choices(g.render()).some(n => text(n).startsWith('[Arcana]')), seen, cls);
  }
});

test('falling to 0 HP in the duel goes to the beacon at 1 HP instead of game over', () => {
  const g = game({success: false, hp: 1});
  g.state().goto('duel1');
  g.click('[Athletics] Catch the hook head-on');
  const s = g.state();
  assert.equal(s.sceneKey, 'signal');
});

test('talking or threatening can end the duel without the railing', () => {
  const talk = game();
  talk.state().goto('duel1');
  talk.click('[Persuade]');
  assert.equal(talk.state().sceneKey, 'top');
  assert.ok(talk.state().flags.includes('peaceful'));
  const threat = game();
  threat.state().goto('duel2');
  threat.click('[Intimidate]');
  assert.equal(threat.state().sceneKey, 'top');
  assert.ok(threat.state().flags.includes('f_ren_keeper'));
});

test('the wire can win the duel once, and is then gone for the repair', () => {
  const g = game({flags: ['sawTrap']});
  g.state().goto('duel2');
  g.click('[Wire]');
  assert.equal(g.state().sceneKey, 'railing');
  assert.ok(g.state().flags.includes('wireUsed'));
  const spent = game({flags: ['sawTrap', 'wireUsed']});
  spent.state().goto('duel2');
  assert.equal(choices(spent.render()).some(n => text(n).startsWith('[Wire]')), false);
});

test('the location card says where you are and what you are doing, tinted by the moment', () => {
  const g = game();
  g.state().goto('duel1');
  const tree = g.render();
  const wrap = nodes(tree).find(n => /^stageWrap/.test(n.props.className || ''));
  assert.match(wrap.props.className, /mood-danger/);
  const card = nodes(wrap).find(n => n.props.className === 'locCard');
  assert.ok(text(card).includes('Duel with Ren'));
  assert.ok(text(card).includes('Fighting Ren — the hook goes up'));
  g.state().goto('railing');
  assert.match(nodes(g.render()).find(n => /^stageWrap/.test(n.props.className || '')).props.className, /mood-hush/);
});

function newRun(store) {
  const g = game({fresh: true, store});
  nodes(g.render()).find(n => n.props.className === 'choice primaryChoice').props.onClick();
  nodes(g.render()).find(n => n.props.className === 'card').props.onClick();
  return g;
}

test('scenes seen in earlier runs are folded to their first line, and can be reopened', () => {
  const g = newRun({aduventure_seen: ['intro']});
  let tree = g.render();
  const narr = nodes(tree).find(n => n.props.className === 'narr');
  assert.ok(text(narr).endsWith(' …'));
  const open = nodes(tree).find(n => n.props.className === 'expandBtn');
  assert.ok(open);
  open.props.onClick();
  tree = g.render();
  assert.equal(nodes(tree).some(n => n.props.className === 'expandBtn'), false);
  assert.ok(!text(nodes(tree).find(n => n.props.className === 'narr')).endsWith(' …'));
  const firstTime = newRun({});
  assert.equal(nodes(firstTime.render()).some(n => n.props.className === 'expandBtn'), false);
});

test('a returning player can jump straight to the forks they have reached', () => {
  const none = newRun({});
  assert.equal(nodes(none.render()).some(n => /fork/.test(n.props.className || '')), false);
  const g = newRun({aduventure_seen: ['intro', 'stairs', 'rescue']});
  const forks = nodes(g.render()).filter(n => /fork/.test(n.props.className || ''));
  assert.equal(forks.length, 2);
  g.run('api.pc && 0');
  forks.find(n => text(n).includes('sluice')).props.onClick();
  const s = g.state();
  assert.equal(s.sceneKey, 'rescue');
  assert.equal(s.pc.hp, s.pc.maxHp);
});

test('scene sounds play once per scene only while sound is on, and never throw', () => {
  const g = game();
  const made = [];
  g.run(`(() => {
    const param = () => ({setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, value: 0});
    const node = () => { const n = {connect() {}, disconnect() {}, start() {}, stop() {}}; globalThis.__made = (globalThis.__made || 0) + 1; return n; };
    _ac = {state: 'running', currentTime: 0, sampleRate: 8000, destination: {}, resume() {},
      createGain: () => Object.assign(node(), {gain: param()}), createBiquadFilter: () => Object.assign(node(), {frequency: param()}),
      createOscillator: () => Object.assign(node(), {frequency: param()}), createBufferSource: () => node(),
      createBuffer: (c, len) => ({getChannelData: () => new Float32Array(len)})};
  })()`);
  const cues = [...new Set(Object.values(g.run('SCENE_SFX')).concat('pen'))];
  g.run('SFX.enabled = false; globalThis.__made = 0');
  for (const c of cues) g.run(`SFX.cue(${JSON.stringify(c)})`);
  assert.equal(g.run('globalThis.__made'), 0, 'Silent while sound is off');
  g.run('SFX.enabled = true');
  for (const c of cues) {
    const before = g.run('globalThis.__made');
    assert.doesNotThrow(() => g.run(`SFX.cue(${JSON.stringify(c)})`));
    assert.ok(g.run('globalThis.__made') > before, c + ' makes a sound');
  }
  assert.equal(made.length, 0);
});

test('the duel raises the tension drone like a fight', () => {
  const g = game();
  const mood = k => g.run(`bgmMood({sceneKey: ${JSON.stringify(k)}, chapter: 1, hp: 12, maxHp: 12})`);
  assert.equal(mood('duel1').tension, 0.8);
  assert.equal(mood('duel2').tension, 1);
  assert.equal(mood('top').tension, 0);
});

test('all pt15 text is bilingual', () => {
  const g = game();
  const strings = g.run(`(() => {
    const out = [];
    const walk = v => {
      if (!v || typeof v !== 'object') return;
      if (typeof v.ko === 'string' && 'en' in v) { out.push(v); return; }
      Object.values(v).forEach(walk);
    };
    walk([SCENES.duel1, SCENES.duel2, SCENE_DOING, SCENE_TITLES.duel1, SCENE_TITLES.duel2]);
    walk(['seenExpand','forkStairs','forkRescue','forkTag'].map(k => UI[k]));
    return out;
  })()`);
  assert.ok(strings.length > 60);
  for (const s of strings) {
    assert.ok(s.ko && s.en, JSON.stringify(s));
    assert.equal(HANGUL.test(s.en), false, s.en);
  }
});

// ---- pt16: 2장 스컬리, 3장 가짜 수도사도 같은 서사 결투로 ----
test('every fight entry in Ch.2 and Ch.3 now leads to its narrative duel', () => {
  const g = game();
  const gotos = g.run(`Object.values(SCENES).flatMap(s => (s.choices || []).flatMap(c => [c.goto, c.success?.goto, c.fail?.goto, c.result?.goto]))`);
  assert.equal(gotos.filter(x => x === 'combat2' || x === 'combat3' || x === 'combat').length, 0, 'No story path enters the old number combat');
  assert.ok(gotos.includes('scully1') && gotos.includes('monk1'));
});

for (const [first, second, edge, exits, down] of [
  ['scully1', 'scully2', 'duelEdge2', ['scully2', 'ending2'], 'gameover'],
  ['monk1', 'monk2', 'duelEdge3', ['monk2', 'rescue'], 'gameover']
]) {
  test(`${first}: two beats, stakes on every choice, every branch exits, 0 HP follows the record`, () => {
    const g = game();
    const branches = g.run(`[${JSON.stringify(first)}, ${JSON.stringify(second)}].flatMap(k => SCENES[k].choices.flatMap(c => [c.success, c.fail, c.result].filter(Boolean).map(b => [k, b.goto, b.ifDown || null])))`);
    for (const [scene, to, d] of branches) {
      assert.ok(scene === first ? exits.includes(to) : to === exits[1], scene + ' -> ' + to);
      if (d) assert.equal(d, down);
    }
    assert.ok(g.run(`[${JSON.stringify(first)}, ${JSON.stringify(second)}].every(k => SCENES[k].choices.every(c => c.stake?.ko && c.stake?.en))`));
    assert.ok(g.run(`SCENES[${JSON.stringify(second)}].choices.some(c => c.echoReq === ${JSON.stringify(edge)})`), 'The first beat can earn an easier finish');
    assert.ok(g.run(`SCENES[${JSON.stringify(first)}].choices.some(c => c.classOnly === 'wizard')`), 'The wizard has an own option');
  });
}

test('Scully duel: winning the exchange, then pressing it, ends the chapter with Scully caught', () => {
  const g = game({sceneKey: 'confront'});
  g.state().goto('scully1');
  g.click('[Perception]');
  assert.equal(g.state().sceneKey, 'scully2');
  g.click('[Athletics] Press the opening');
  const s = g.state();
  assert.equal(s.sceneKey, 'ending2');
  assert.equal(s.flags.includes('scullyFled'), false);
  assert.ok(text(g.render()).includes('Scully is in'));
});

test('Scully duel: grabbing the letters keeps the evidence but loses the man', () => {
  const g = game({sceneKey: 'confront'});
  g.state().goto('scully2');
  const tree = g.click('Snatch the letters first');
  assert.equal(g.state().sceneKey, 'ending2');
  assert.ok(g.state().flags.includes('scullyFled'));
  assert.ok(text(tree).includes('Scully fled out the back door'));
  assert.equal(g.run(`officialRecord(2, ['scullyFled'], 113).lines[0].en`), 'Docks: smuggling suspect Scully, fled.');
  assert.ok(g.run(`chapterLedger(2, ['scullyFled']).some(r => r.kept === false && r.text.en === 'Scully — got away')`));
});

test('the monk duel: lifting the keys frees the prisoners and counts as a silent rescue', () => {
  const g = game({sceneKey: 'undercroft'});
  g.state().goto('monk2');
  g.click('[Stealth] Forget the fight');
  assert.equal(g.state().sceneKey, 'rescue');
  assert.ok(g.state().flags.includes('quiet3'));
});

test('falling in the Ch.2 duel makes the record come true', () => {
  const g = game({sceneKey: 'confront', success: false, hp: 1});
  g.state().goto('scully1');
  g.click('[Perception]');
  assert.equal(g.state().sceneKey, 'gameover');
});

test('all pt16 duel text is bilingual', () => {
  const g = game();
  const strings = g.run(`(() => {
    const out = [];
    const walk = v => {
      if (!v || typeof v !== 'object') return;
      if (typeof v.ko === 'string' && 'en' in v) { out.push(v); return; }
      Object.values(v).forEach(walk);
    };
    walk(['scully1','scully2','monk1','monk2'].map(k => [SCENES[k], SCENE_TITLES[k], SCENE_DOING[k]]));
    walk([buildEnding2(['scullyFled']), chapterLedger(2, ['scullyFled'])]);
    return out;
  })()`);
  assert.ok(strings.length > 80);
  for (const s of strings) {
    assert.ok(s.ko && s.en, JSON.stringify(s));
    assert.equal(HANGUL.test(s.en), false, s.en);
  }
});
