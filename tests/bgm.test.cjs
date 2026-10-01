// pt12 — 상태 반응형 배경음과 선택 직전 '걸린 것' 예고.
// bgmMood(순수 함수)의 규칙과, 가짜 AudioContext 위에서 BGM 층이 그 규칙을 따르는지 확인한다.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(process.env.GAME_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');
const app = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1].split('ReactDOM.createRoot')[0];
const section = (start, end) => {
  const from = app.indexOf(start), to = app.indexOf(end, from);
  assert.ok(from >= 0 && to > from, 'Source section: ' + start);
  return app.slice(from, to);
};
const AUDIO = section('let _ac = null;', 'const d = sides =>');

function fakeAudio() {
  const made = [];
  const param = value => ({value, target: value, setTargetAtTime(v) { this.target = v; }, setValueAtTime() {}, exponentialRampToValueAtTime() {}});
  const node = type => {
    const n = {kind: type, connect() {}, disconnect() {}, start() { n.started = true; }, stop() { n.stopped = true; }};
    made.push(n);
    return n;
  };
  class Ctx {
    constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 8000; this.destination = {}; }
    resume() {}
    createGain() { return Object.assign(node('gain'), {gain: param(1)}); }
    createBiquadFilter() { return Object.assign(node('filter'), {frequency: param(350)}); }
    createOscillator() { return Object.assign(node('osc'), {frequency: param(440)}); }
    createBufferSource() { return node('noise'); }
    createBuffer(ch, len) { return {getChannelData: () => new Float32Array(len)}; }
  }
  return {Ctx, made};
}

function audio({withContext = true} = {}) {
  const fake = fakeAudio();
  const timers = [];
  const ctx = vm.createContext({
    Math, window: withContext ? {AudioContext: fake.Ctx} : {},
    setTimeout: fn => { fn(); return 0; },
    setInterval: (fn, ms) => timers.push({fn, ms, live: true}) - 1,
    clearInterval: id => { if (timers[id]) timers[id].live = false; }
  });
  vm.runInContext(AUDIO + '; globalThis.api = {SFX, BGM, bgmMood, BGM_THEMES, BGM_HUSH};', ctx);
  return {...ctx.api, made: fake.made, timers};
}

const base = {sceneKey: 'door', chapter: 1, hp: 12, maxHp: 12, combat: false, enemyIntent: null, enemyDone: false, playerDown: false, ending: false, gameover: false};

test('mood follows chapter, and falls silent before the heavy choices', () => {
  const {bgmMood} = audio();
  for (const chapter of [1, 2, 3]) assert.equal(bgmMood({...base, chapter}).theme, chapter);
  assert.deepEqual({...bgmMood(base)}, {theme: 1, drone: 1, rain: 1, tension: 0, pulse: 0});
  for (const sceneKey of ['railing', 'rescue', 'signal']) {
    const m = bgmMood({...base, sceneKey});
    assert.equal(m.drone, 0, sceneKey);
    assert.ok(m.rain < 1, sceneKey);
  }
  assert.equal(bgmMood({...base, gameover: true}).drone, 0);
});

test("tension rises fully on Ren's telegraphed smash, and stops once the fight ends", () => {
  const {bgmMood} = audio();
  const fight = {...base, sceneKey: 'combat', combat: true};
  assert.equal(bgmMood({...fight, enemyIntent: 'hook'}).tension, 1);
  assert.equal(bgmMood({...fight, enemyIntent: 'slash'}).tension, 0.45);
  assert.equal(bgmMood({...fight, enemyIntent: 'hook', enemyDone: true}).tension, 0);
  assert.equal(bgmMood({...fight, enemyIntent: 'hook', playerDown: true}).tension, 0);
});

test('a heartbeat appears as HP falls, faster when it is critical', () => {
  const {bgmMood} = audio();
  assert.equal(bgmMood({...base, hp: 4}).pulse, 104, '1/3 HP outside combat');
  assert.equal(bgmMood({...base, hp: 6}).pulse, 0, 'half HP outside combat is calm');
  assert.equal(bgmMood({...base, hp: 6, combat: true}).pulse, 76, 'half HP in a fight');
  assert.equal(bgmMood({...base, hp: 0}).pulse, 0, 'no heartbeat at 0 HP');
});

test('the sound layer applies the mood: theme notes, tension, heartbeat, and clean stop', () => {
  const a = audio();
  assert.equal(a.SFX.toggle(), true);
  a.BGM.apply(a.bgmMood(base));
  const oscs = () => a.made.filter(n => n.kind === 'osc' && n.started && !n.stopped && n.frequency.value < 200 && n.frequency.value > 50);
  assert.equal(oscs().length, a.BGM_THEMES[1].notes.length * 2, 'two detuned voices per note');
  a.BGM.apply(a.bgmMood({...base, chapter: 3}));
  assert.equal(a.BGM._theme, 3);
  assert.equal(oscs().length, a.BGM_THEMES[3].notes.length * 2, 'old chapter voices are stopped');
  a.BGM.apply(a.bgmMood({...base, sceneKey: 'combat', combat: true, enemyIntent: 'hook', hp: 3}));
  assert.equal(a.BGM._nodes.tensionGain.gain.target, 0.06);
  assert.equal(a.timers.filter(t => t.live).length, 1);
  assert.equal(a.timers.find(t => t.live).ms, Math.round(60000 / 104));
  assert.equal(a.SFX.toggle(), false);
  assert.equal(a.BGM._nodes, null);
  assert.equal(a.timers.some(t => t.live), false, 'heartbeat stops with the sound');
  assert.ok(a.made.filter(n => n.kind === 'osc' || n.kind === 'noise').every(n => !n.started || n.stopped), 'every voice is stopped');
});

test('without Web Audio, toggling and applying never throw', () => {
  const a = audio({withContext: false});
  assert.doesNotThrow(() => { a.SFX.toggle(); a.BGM.apply(a.bgmMood(base)); a.SFX.toggle(); });
  assert.equal(a.BGM._nodes, null);
});

// 선택 직전 '걸린 것' 예고 — 실제 렌더에서 확인
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
function render(sceneKey, lang) {
  const states = [];
  let index = 0;
  const data = new Map([['aduventure_lang', JSON.stringify(lang)]]);
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
  vm.runInContext(app, ctx);
  data.set('aduventure_save', JSON.stringify({
    v: 1, sceneKey, flags: [], ruleKey: 'srd20', fate: 1, specialLeft: 2, breathLeft: 1, tutSeen: true,
    pc: {...vm.runInContext('CLASSES.fighter', ctx), classKey: 'fighter', name: 'QA', hp: 12}, stats: {rolls: 0, success: 0}
  }));
  const draw = () => { index = 0; return vm.runInContext('CRPG()', ctx); };
  nodes(draw()).find(n => n.props.className === 'continueBtn').props.onClick();
  return {tree: draw(), run: code => vm.runInContext(code, ctx)};
}

for (const lang of ['ko', 'en']) {
  for (const sceneKey of ['railing', 'rescue']) {
    test(`${lang}: ${sceneKey} shows what each choice puts at stake before it is made`, () => {
      const {tree, run} = render(sceneKey, lang);
      const buttons = nodes(tree).filter(n => n.type === 'button' && n.props.className === 'choice');
      assert.equal(buttons.length, 2);
      const expected = run(`SCENES.${sceneKey}.choices.map(c => c.stake.${lang})`);
      buttons.forEach((b, i) => {
        const stake = nodes(b).find(n => n.props.className === 'stake');
        assert.ok(stake, 'stake line on choice ' + i);
        assert.equal(text(stake), run(`UI.stakeLabel.${lang}`) + expected[i]);
      });
      if (lang === 'en') assert.equal(/[가-힣]/.test(text(buttons)), false);
    });
  }
}

test('every stake is bilingual', () => {
  const {run} = render('railing', 'en');
  const stakes = run('Object.values(SCENES).flatMap(s => s.choices || []).filter(c => c.stake).map(c => c.stake)');
  assert.ok(stakes.length >= 6);
  for (const s of stakes) {
    assert.ok(s.ko && s.en);
    assert.equal(/[가-힣]/.test(s.en), false, s.en);
  }
});
