'use strict';
// 가상 플레이어 100명 시뮬레이터 — 실제 index.html 게임 코드를 그대로 실행하고,
// 사람마다 다른 읽기 속도·인내심·위험 성향·호기심·추리력으로 버튼을 "눌러" 본다.
// 측정: 어디까지 갔나 / 어디서 그만뒀나 / 시간 / 결투 시간 초과 / 반박 성공 / 의뢰 / 다시 하기.
// 한계: 성향 모델은 가정이다(⚠추론). 재미 자체가 아니라 구조(막힘·길이·난이도·도달률)를 본다.
// 사용: node tools/persona-sim.cjs [index.html] [명수=100] [seed] [--json out.json] [--transcripts dir]
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const args = process.argv.slice(2);
const flag = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const FILE = pos[0] || path.join(__dirname, '..', 'index.html');
const N = Number(pos[1] || 100);
const SEED = pos[2] || '20261003';
const JSON_OUT = flag('--json');
const TX_DIR = flag('--transcripts');

const html = fs.readFileSync(FILE, 'utf8');
const app = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1].split('ReactDOM.createRoot')[0];

function rng(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let s = h >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

/* ---------------- 페르소나 ---------------- */
const ARCHETYPES = [
  { id: 'casual',   ko: '모바일 캐주얼 초보',     read: [6, 9],   patience: 0.30, risk: 0.30, curiosity: 0.30, deduction: 0.30, goal: 0.30, story: 0.40, replay: 0.30, budget: [8, 15],  lang: 'ko' },
  { id: 'story',    ko: '이야기 몰입형',           read: [5, 8],   patience: 0.85, risk: 0.35, curiosity: 0.60, deduction: 0.55, goal: 0.30, story: 0.90, replay: 0.55, budget: [25, 50], lang: 'ko' },
  { id: 'explorer', ko: '탐험가(안 가본 길)',       read: [8, 12],  patience: 0.70, risk: 0.50, curiosity: 0.95, deduction: 0.50, goal: 0.40, story: 0.60, replay: 0.75, budget: [25, 45], lang: 'ko' },
  { id: 'gambler',  ko: '도박꾼(어려운 선택)',      read: [10, 15], patience: 0.50, risk: 0.90, curiosity: 0.50, deduction: 0.40, goal: 0.30, story: 0.30, replay: 0.55, budget: [15, 30], lang: 'ko' },
  { id: 'achiever', ko: '성취가(의뢰 사냥)',        read: [9, 13],  patience: 0.65, risk: 0.45, curiosity: 0.55, deduction: 0.55, goal: 0.95, story: 0.40, replay: 0.70, budget: [20, 40], lang: 'ko' },
  { id: 'detective',ko: '추리광',                   read: [7, 10],  patience: 0.80, risk: 0.40, curiosity: 0.70, deduction: 0.90, goal: 0.50, story: 0.70, replay: 0.65, budget: [25, 50], lang: 'ko' },
  { id: 'speed',    ko: '스피드러너(글 대충)',      read: [18, 28], patience: 0.25, risk: 0.60, curiosity: 0.30, deduction: 0.30, goal: 0.40, story: 0.10, replay: 0.45, budget: [10, 20], lang: 'ko' },
  { id: 'english',  ko: '영어권 RPG 팬',            read: [14, 20], patience: 0.60, risk: 0.50, curiosity: 0.60, deduction: 0.55, goal: 0.45, story: 0.60, replay: 0.50, budget: [20, 40], lang: 'en' },
  { id: 'student',  ko: '고등학생(수업 중)',         read: [7, 11],  patience: 0.40, risk: 0.55, curiosity: 0.50, deduction: 0.40, goal: 0.50, story: 0.40, replay: 0.45, budget: [10, 18], lang: 'ko' },
  { id: 'veteran',  ko: '텍스트 RPG 베테랑',        read: [10, 14], patience: 0.85, risk: 0.50, curiosity: 0.75, deduction: 0.75, goal: 0.60, story: 0.75, replay: 0.80, budget: [30, 60], lang: 'ko' },
  { id: 'steamcritic', ko: '깐깐한 스팀 리뷰어',     read: [12, 18], patience: 0.45, risk: 0.55, curiosity: 0.60, deduction: 0.60, goal: 0.50, story: 0.50, replay: 0.35, budget: [20, 45], lang: 'en' },
  { id: 'ifcritic', ko: '인터랙티브 픽션 비평가',     read: [9, 13],  patience: 0.80, risk: 0.45, curiosity: 0.85, deduction: 0.80, goal: 0.30, story: 0.95, replay: 0.55, budget: [30, 60], lang: 'en' }
];
const CLASSES = ['fighter', 'rogue', 'wizard'];
function makePersonas(n, seed) {
  const r = rng(seed + ':personas');
  const jit = (v, s = 0.15) => clamp(v + (r() * 2 - 1) * s);
  return Array.from({ length: n }, (_, i) => {
    const a = ARCHETYPES[i % ARCHETYPES.length];
    return {
      no: i + 1, archetype: a.id, label: a.ko, lang: a.lang,
      readCps: a.read[0] + r() * (a.read[1] - a.read[0]) * (a.lang === 'en' ? 1 : 1),
      patience: jit(a.patience), risk: jit(a.risk), curiosity: jit(a.curiosity), deduction: jit(a.deduction),
      goal: jit(a.goal), story: jit(a.story), replay: jit(a.replay),
      budgetMin: a.budget[0] + r() * (a.budget[1] - a.budget[0]),
      cls: CLASSES[Math.floor(r() * 3)], seed: seed + ':' + (i + 1)
    };
  });
}

/* ---------------- 미니 React (훅·효과·가상 시계) ---------------- */
function createWorld(persona) {
  const random = rng(persona.seed + ':game');
  const math = Object.create(Math); math.random = random;
  const data = new Map([['aduventure_lang', JSON.stringify(persona.lang)], ['aduventure_sfx', 'false'], ['aduventure_tut_seen', 'true']]);
  let now = 0; const timers = []; let tid = 1;
  const setT = (fn, ms, rep) => { const t = { id: tid++, fn, at: now + Math.max(0, ms || 0), every: rep ? Math.max(1, ms || 1) : 0, live: true }; timers.push(t); return t.id; };
  const clearT = id => { const t = timers.find(x => x.id === id); if (t) t.live = false; };
  const hooks = new Map(); let pathStack = []; let cursor = null; const pendingEffects = []; let dirty = false;
  const errors = [];
  function useState(init) {
    const st = cursor; const i = st.i++;
    if (!(i in st.h)) st.h[i] = { v: typeof init === 'function' ? init() : init };
    const slot = st.h[i];
    return [slot.v, v => { const nv = typeof v === 'function' ? v(slot.v) : v; if (!Object.is(nv, slot.v)) { slot.v = nv; dirty = true; } }];
  }
  function useRef(init) { const st = cursor; const i = st.i++; if (!(i in st.h)) st.h[i] = { current: init }; return st.h[i]; }
  function useEffect(fn, deps) {
    const st = cursor; const i = st.i++;
    const prev = st.h[i];
    const changed = !prev || !deps || !prev.deps || deps.length !== prev.deps.length || deps.some((d, k) => !Object.is(d, prev.deps[k]));
    if (!prev) st.h[i] = { deps, cleanup: null };
    if (changed) pendingEffects.push({ slot: st.h[i], fn, deps });
  }
  const ctx = vm.createContext({
    console: { log() {}, warn() {}, error() {} }, Math: math, Date, JSON, Number, String, Object, Array, Set, Map, Promise, Error, RegExp, isNaN, parseInt,
    setTimeout: (fn, ms) => setT(fn, ms, false), clearTimeout: clearT, setInterval: (fn, ms) => setT(fn, ms, true), clearInterval: clearT,
    performance: { now: () => now },
    window: { addEventListener() {}, removeEventListener() {}, scrollY: 0, scrollTo() {} },
    document: { documentElement: {}, addEventListener() {}, removeEventListener() {}, hidden: false, querySelector: () => null, title: '' },
    navigator: {},
    fetch: () => Promise.reject(new Error('offline')),
    localStorage: { getItem: k => data.has(k) ? data.get(k) : null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) },
    React: { Fragment: 'fragment', createElement: (type, props, ...children) => ({ type, props: props || {}, children }), useState, useRef, useEffect }
  });
  ctx.window.AudioContext = undefined;
  vm.runInContext(app.replace('  const pct = choice =>', 'globalThis.__api = { get s() { return { sceneKey, scene, flags, pc, lore, runNo, rolling, pending, timerOn, enemy, objection, fate, stats, lastResult }; }, pct: c => pct(c), narrativeId: c => narrativeId(c) };\n  const pct = choice =>'), ctx);

  // 함수 컴포넌트를 펼쳐 실제 트리로 만든다(컴포넌트마다 훅 저장소를 따로 둔다).
  function expand(node, p) {
    if (node == null || typeof node === 'boolean') return null;
    if (Array.isArray(node)) return node.map((n, i) => expand(n, p + '.' + i));
    if (typeof node !== 'object') return node;
    if (typeof node.type === 'function') {
      const key = p + ':' + (node.type.name || 'anon');
      if (!hooks.has(key)) hooks.set(key, { h: {} });
      const saved = cursor; cursor = hooks.get(key); cursor.i = 0;
      let out;
      try { out = node.type({ ...node.props, children: node.children.length ? node.children : node.props.children }); } finally { cursor = saved; }
      return expand(out, key);
    }
    return { type: node.type, props: node.props, children: node.children.map((c, i) => expand(c, p + '.' + (c && c.props && c.props.key != null ? 'k' + c.props.key : i))) };
  }
  let tree = null;
  function render() {
    for (let loop = 0; loop < 30; loop++) {
      dirty = false;
      pendingEffects.length = 0;
      try { tree = expand({ type: ctx.CRPG, props: {}, children: [] }, 'root'); }
      catch (e) { errors.push('render: ' + e.message); throw e; }
      const effects = pendingEffects.splice(0);
      for (const ef of effects) {
        try { if (ef.slot.cleanup) ef.slot.cleanup(); const c = ef.fn(); ef.slot.cleanup = typeof c === 'function' ? c : null; ef.slot.deps = ef.deps; }
        catch (e) { errors.push('effect: ' + e.message); }
      }
      if (!dirty) return tree;
    }
    return tree;
  }
  ctx.CRPG = vm.runInContext('CRPG', ctx);
  function advance(ms) {
    const end = now + ms;
    for (let guard = 0; guard < 5000; guard++) {
      const due = timers.filter(t => t.live && t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      now = Math.max(now, due.at);
      if (due.every) due.at += due.every; else due.live = false;
      try { due.fn(); } catch (e) { errors.push('timer: ' + e.message); }
      render();
    }
    now = end;
    return render();
  }
  return { ctx, data, render, advance, errors, get now() { return now; }, api: () => ctx.__api };
}

/* ---------------- 트리 읽기 ---------------- */
function all(n) { if (!n || typeof n !== 'object') return []; if (Array.isArray(n)) return n.flatMap(all); return [n, ...(n.children || []).flatMap(all)]; }
function text(n) { if (n == null || typeof n === 'boolean') return ''; if (Array.isArray(n)) return n.map(text).join(''); return typeof n === 'object' ? text(n.children) : String(n); }
const cls = n => typeof n.props.className === 'string' ? n.props.className : '';
const buttons = tree => all(tree).filter(n => n.type === 'button' && typeof n.props.onClick === 'function' && !n.props.disabled);

/* ---------------- 한 사람의 플레이 ---------------- */
const GOAL_FLAGS = { ren: ['caughtRen', 'peaceful', 'bothRail'], light: ['fixed'], nofight: ['peaceful'], rounds: [], scully: ['peaceful2'], quiet: ['quiet3'], courier: ['saved3'], pieces: [], objection: [] };
function play(persona) {
  const r = rng(persona.seed + ':mind');
  const w = createWorld(persona);
  const T = []; // 기록(사람이 읽을 수 있는 로그)
  const log = s => T.push(`[${(w.now / 60000).toFixed(1)}분] ${s}`);
  const out = { persona, runs: [], quitReason: null, totalMin: 0, timeouts: 0, timerOffBy: null, objections: { tried: 0, won: 0, sealed: 0, retried: 0 }, deductions: { tried: 0, solved: 0 }, errors: w.errors, transcript: T, sawCase2: false, maxChapter: 0, scenesSeen: new Set(), readMinutes: 0, longestScene: { key: null, sec: 0 } };
  let frustration = 0, fun = 0, run = null, steps = 0, objectionDone = new Set();
  let tree;
  const think = sec => { tree = w.advance(Math.round(sec * 1000)); };
  const readSec = chars => chars / persona.readCps;
  tree = w.render();
  const newRun = () => { run = { no: out.runs.length + 1, endings: [], deaths: 0, checks: 0, fails: 0, goals: 0, startMin: w.now / 60000, scenes: 0 }; out.runs.push(run); };
  const click = (b, why) => { log(why); b.props.onClick({ target: {}, preventDefault() {} }); tree = w.render(); };
  const lastScene = { key: null };
  while (steps++ < 900) {
    const s = w.api() ? w.api().s : null;
    const bs = buttons(tree);
    // 규칙 안내 창(첫 판정 전)이 떠 있으면 읽고 닫는다.
    const tut = bs.find(b => /이해했다, 주사위를 다오|Got it — give me the dice/.test(text(b)));
    if (tut) { const tt = all(tree).find(n => cls(n) === 'tut'); think(readSec(text(tt || '').length) * (persona.story < 0.3 ? 0.3 : 0.8) + 2); click(tut, '규칙 안내 읽고 닫음'); continue; }
    const minutes = w.now / 60000;
    // 1) 첫 화면 / 이름·직업
    if (!s || !s.pc) {
      const cont = bs.find(b => cls(b) === 'continueBtn');
      const cards = bs.filter(b => cls(b) === 'card');
      if (cards.length) {
        const nameIn = all(tree).find(n => n.type === 'input' && cls(n) === 'nameIn');
        if (nameIn) { nameIn.props.onChange({ target: { value: 'P' + persona.no } }); tree = w.render(); }
        think(readSec(text(all(tree).find(n => cls(n) === 'pick')).length * (persona.story < 0.3 ? 0.15 : 0.4)) + 4);
        const want = persona.cls;
        const card = buttons(tree).filter(b => cls(b) === 'card')[CLASSES.indexOf(want)] || buttons(tree).filter(b => cls(b) === 'card')[0];
        newRun();
        click(card, `직업 고름: ${want}`);
        continue;
      }
      const opening = bs.filter(b => cls(b).startsWith('choice'));
      if (opening.length) { think(readSec(text(all(tree).find(n => cls(n) === 'recordCard') || '').length + 120) + 3); click(opening[r() < 0.7 ? 0 : opening.length - 1], '첫 화면: 공식 기록에 답한다'); continue; }
      if (cont) { click(cont, '이어서 하기'); continue; }
      const any = bs.find(b => /rulesGot|알겠|Got it/i.test(text(b)));
      if (any) { click(any, '규칙 확인'); continue; }
      out.quitReason = 'stuck:title'; break;
    }
    if (!run) newRun();
    // 굴리는 중이면 시간만 흘린다.
    if (s.rolling) { think(1.2); continue; }
    const key = s.sceneKey, scene = s.scene;
    if (key !== lastScene.key) {
      lastScene.key = key; run.scenes++;
      const fresh = !out.scenesSeen.has(key); out.scenesSeen.add(key);
      if (scene && scene.ch) out.maxChapter = Math.max(out.maxChapter, scene.ch === 5 ? 4 : scene.ch);
      if (key.startsWith('c2_')) out.sawCase2 = true;
      // 읽기: 서사 + 결과 + 대사. 이미 본 장면은 접혀 있어 조금만 읽는다.
      const narr = all(tree).filter(n => ['narr', 'result good', 'result bad', 'result ', 'banter', 'pickShare', 'echoBanner'].includes(cls(n))).map(text).join(' ');
      const skim = persona.story < 0.3 ? 0.5 : 1;
      const sec = readSec(narr.length) * skim;
      out.readMinutes += sec / 60;
      if (sec > out.longestScene.sec) out.longestScene = { key, sec: Math.round(sec) };
      // 인내심보다 긴 글은 지루함.
      const tolerance = 20 + 60 * persona.patience;
      if (sec > tolerance) frustration += 0.06 * (sec / tolerance);
      if (fresh) fun += 0.03;
      const res = all(tree).find(n => /^result (good|bad)/.test(cls(n)));
      if (res) { run.checks++; if (cls(res).includes('bad')) { run.fails++; frustration += 0.05 * (1 - persona.risk * 0.5); } else fun += 0.04; }
      log(`장면 ${key}${fresh ? '' : ' (다시)'} — 읽기 ${Math.round(sec)}초${res ? (cls(res).includes('bad') ? ' · 판정 실패' : ' · 판정 성공') : ''}`);
      // 결투 마지막 수: 읽는 동안 시계가 돈다.
      const timer = all(tree).find(n => cls(n).startsWith('duelTimer'));
      if (timer && s.timerOn) {
        const before = key;
        const choicesChars = buttons(tree).filter(b => cls(b).startsWith('choice')).map(text).join(' ').length;
        const decide = sec + readSec(choicesChars) + 2 + 6 * (1 - persona.risk) * (1 - (persona.readCps - 5) / 25);
        think(decide);
        tree = w.render();
        if (w.api().s.sceneKey !== before) {
          out.timeouts++; frustration += 0.12 * (1 - persona.patience); log(`⏳ 시간 초과(결정까지 ${Math.round(decide)}초 필요) — 망설임 처리`);
          if (persona.patience < 0.55 && r() < 0.5 && out.timerOffBy == null) out.timerOffBy = 'next';
          continue;
        }
      } else think(sec);
    }
    // 시간 제한 끄기(망설임을 겪은 성급하지 않은 사람 일부)
    if (out.timerOffBy === 'next') { const tg = buttons(tree).find(b => cls(b) === 'timerToggle'); if (tg) { click(tg, '⏸ 시간 제한 끔'); out.timerOffBy = key; continue; } }
    // 그만두기 판단(장면 사이): 지루함 누적 또는 시간 예산 초과
    if (frustration - fun > 0.55 + persona.patience * 0.6) { out.quitReason = `지루함/좌절 @${key}`; log('😴 그만둠: 지루하거나 막힘'); break; }
    if (minutes > persona.budgetMin * 1.25) { out.quitReason = `시간 다 씀 @${key}`; log('⌛ 그만둠: 시간이 다 됨'); break; }
    const bsNow = buttons(tree);
    // 2) 판정 실패 후 운명 주사위 선택
    const fateBtn = bsNow.find(b => cls(b) === 'choice fate');
    if (fateBtn) { const acceptBtn = bsNow.filter(b => cls(b) === 'choice')[0]; think(3); if (r() < 0.75 || !acceptBtn) click(fateBtn, '운명 주사위 다시 굴림'); else click(acceptBtn, '실패 받아들임'); continue; }
    // 3) 엔딩 화면: 반박 → 다음 장/다시
    if (scene && (scene.ending || scene.gameover)) {
      const end = scene.ending || 'gameover';
      if (!run.endings.includes(end)) {
        run.endings.push(end);
        if (scene.gameover) { run.deaths++; frustration += 0.18 * (1 - persona.risk * 0.4); log('💀 쓰러짐'); }
        else { fun += 0.15; log(`🏁 엔딩 ${end}`); }
        const g = all(tree).find(n => cls(n) === 'goals');
        if (g) { const m = text(g).match(/(\d)\/3/); if (m) { run.goals = Math.max(run.goals, +m[1]); fun += 0.05 * +m[1] * persona.goal; } }
      }
      const obj = all(tree).find(n => /^objection/.test(cls(n)));
      const objBtns = bsNow.filter(b => /^choice obj/.test(cls(b)));
      if (obj && objBtns.length && !objectionDone.has(run.no + ':' + end)) {
        const start = objBtns.find(b => cls(b) === 'choice objStart');
        if (start) {
          if (r() < 0.35 + 0.6 * Math.max(persona.curiosity, persona.deduction)) { out.objections.tried++; think(4); click(start, '✒ 이의 있음'); continue; }
          objectionDone.add(run.no + ':' + end); log('반박 건너뜀');
        } else {
          const lines = objBtns.filter(b => cls(b) === 'choice objLine');
          if (lines.length) {
            think(readSec(text(obj).length) + 4);
            const right = lines.length > 1 ? 1 : 0; // 실제 거짓 줄(REBUTTALS.line)은 모두 1번
            const pick = r() < 0.45 + 0.5 * persona.deduction ? right : (right ? 0 : 1);
            click(lines[pick] || lines[0], `거짓 줄 짚음: ${pick === right ? '맞음' : '틀림'}`); continue;
          }
          const evs = objBtns.filter(b => cls(b) === 'choice objEvidence');
          if (evs.length) {
            think(readSec(text(obj).length) + 5);
            const ch = scene.ending;
            const proofIds = JSON.parse(vm.runInContext(`JSON.stringify(REBUTTALS[${ch}].proof)`, w.ctx));
            const names = vm.runInContext(`JSON.stringify(Object.fromEntries(Object.entries(EVIDENCE).map(([k,v]) => [k, v.name.${persona.lang}])))`, w.ctx);
            const nm = JSON.parse(names);
            const good = evs.filter(b => proofIds.some(id => text(b).includes(nm[id])));
            const bad = evs.filter(b => !good.includes(b));
            const pickGood = good.length && (bad.length === 0 || r() < 0.35 + 0.6 * persona.deduction);
            const b = pickGood ? good[Math.floor(r() * good.length)] : bad[Math.floor(r() * bad.length)] || evs[0];
            if (/once more|한 번 더/.test(text(obj))) out.objections.retried++;
            click(b, `증거 냄: ${text(b).slice(0, 18)}…`); continue;
          }
        }
      }
      const res = obj && text(obj);
      if (obj && !objectionDone.has(run.no + ':' + end) && /Red ink strikes|붉은 잉크가 그 줄을/.test(res)) { out.objections.won++; fun += 0.2; objectionDone.add(run.no + ':' + end); log('✒ 반박 성공'); }
      else if (obj && !objectionDone.has(run.no + ':' + end) && /record stands|확정된다/.test(res)) { out.objections.sealed++; frustration += 0.08; objectionDone.add(run.no + ':' + end); log('✒ 반박 실패(확정)'); }
      // 추리 성향이 있으면 🔎 사건 기록장을 열고 추론을 확인해 본다(한 판에 한 번).
      if (!run.deduceTried && persona.deduction > 0.5 && r() < 0.4 + 0.5 * persona.curiosity) {
        run.deduceTried = true;
        const caseBtn = buttons(tree).find(b => b.props['aria-label'] === 'case board');
        if (caseBtn) {
          click(caseBtn, '🔎 사건 기록장을 연다');
          const box = all(tree).find(n => /^deduce/.test(cls(n)));
          const sels = box ? all(box).filter(n => n.type === 'select' && !n.props.disabled) : [];
          if (sels.length === 3) {
            const ans = JSON.parse(vm.runInContext('JSON.stringify(DEDUCE)', w.ctx));
            ['who', 'what', 'why'].forEach((k, i) => {
              const ids = Object.keys(ans[k]);
              const right = r() < 0.3 + 0.6 * persona.deduction;
              const v = right ? ans.answer[k] : ids.filter(x => x !== ans.answer[k])[Math.floor(r() * (ids.length - 1))];
              sels[i].props.onChange({ target: { value: v } }); tree = w.render();
            });
            think(25 + 20 * persona.story);
            const chk = buttons(tree).find(b => /deduceBtn/.test(cls(b)));
            if (chk) { click(chk, '추론 확인'); out.deductions.tried++; const t = text(all(tree).find(n => /^deduce/.test(cls(n)))); if (/추론 확정|Deduction confirmed/.test(t)) { out.deductions.solved++; fun += 0.3; log('🟥 추론 확정'); } else { const m = t.match(/셋 중 (\d)개|(\d) of three/); log('추론: ' + (m ? (m[1] || m[2]) + '/3' : '?')); } }
          }
          const close = buttons(tree).find(b => b.props.onClick && /닫기|Close|✕|×/.test(text(b)) && all(tree).some(n => cls(n).includes('caseBoard')));
          if (close) { close.props.onClick(); tree = w.render(); }
          continue;
        }
      }
      // 다음으로 갈지
      const primary = bsNow.find(b => cls(b) === 'restart primary');
      const others = bsNow.filter(b => cls(b) === 'restart');
      // 앞으로 가는 버튼(다음 장·판결하러·사건 2)이 있으면 이어 간다. 없으면 한 판이 끝난 것.
      const forward = primary && /계속 →|Continue to|결론을 내린다|reach a verdict|사건 2|Case 2/.test(text(primary)) ? primary : null;
      const wantsMore = forward && (minutes < persona.budgetMin || r() < persona.patience * 0.5);
      if (forward && wantsMore) { think(2); click(forward, '다음으로: ' + text(forward).slice(0, 20)); continue; }
      const isFinal = true;
      if (isFinal) {
        run.endMin = w.now / 60000;
        const keepGoing = persona.replay + 0.12 * run.goals * persona.goal + 0.1 * (fun - frustration) + (scene.ending === 3 ? 0.15 : 0) - (minutes > persona.budgetMin ? 0.5 : 0);
        log(`한 판 끝 — 다시 할 마음 ${(keepGoing * 100).toFixed(0)}%`);
        if (r() > clamp(keepGoing, 0.03, 0.95) || out.runs.length >= 6) { out.quitReason = out.runs.length >= 6 ? '6판 채움' : `판 끝나고 그만둠 (${scene.gameover ? '죽음' : '엔딩 ' + scene.ending})`; break; }
        frustration *= 0.6; objectionDone = new Set();
        const btn = primary || others[others.length - 1];
        if (!btn) { out.quitReason = 'stuck:ending'; break; }
        click(btn, '새 기록(다시 하기)'); newRun(); continue;
      }
      if (primary) { think(2); click(primary, '다음 장으로'); continue; }
      out.quitReason = 'stuck:ending'; break;
    }
    // 4) 전투
    if (scene && scene.combat) {
      const cb = bsNow.filter(b => cls(b) === 'choice');
      if (!cb.length) { think(1); if (steps % 50 === 0) { out.quitReason = 'stuck:combat'; break; } continue; }
      think(3 + 4 * persona.story * 0.5);
      const t = cb.map(text);
      const hp = s.pc.hp / s.pc.maxHp;
      let i = 0;
      const find = re => t.findIndex(x => re.test(x));
      if (cb.length === 1) i = 0;
      else if (hp < 0.4 && find(/숨|Breath|막는다|Defend|받아넘|Parry|Guard/) >= 0) i = find(/숨|Breath|막는다|Defend|받아넘|Parry|Guard/);
      else if (persona.risk > 0.6 && find(/특수|Special|교란|Disrupt/) >= 0) i = find(/특수|Special|교란|Disrupt/);
      else i = Math.floor(r() * Math.min(cb.length, 2));
      click(cb[i], `전투: ${t[i].slice(0, 16)}`); continue;
    }
    // 5) 일반 선택지
    const choiceBtns = bsNow.filter(b => /^choice( |$)/.test(cls(b)) && !/obj|fate/.test(cls(b)));
    if (!choiceBtns.length) {
      // 숨겨진 진행 버튼(계속 등) 찾기
      const nxt = bsNow.find(b => cls(b) === 'restart primary') || bsNow.find(b => cls(b) === 'expandBtn');
      if (nxt) { click(nxt, '진행'); continue; }
      out.quitReason = `stuck:${key}`; log('막힘: 누를 버튼이 없다 — 보이는 버튼: ' + bsNow.map(b => cls(b) + '«' + text(b).slice(0, 20) + '»').join(', ') + ' · rolling=' + s.rolling + ' pending=' + !!s.pending + ' classes=' + [...new Set(all(tree).map(cls).filter(Boolean))].join(',')); break;
    }
    const sc = scene && scene.choices || [];
    const scored = choiceBtns.map(b => {
      const k = b.props.key && String(b.props.key);
      const idx = k && k.startsWith(key + ':') ? +k.split(':')[1] : -1;
      const ch = idx >= 0 ? sc[idx] : null;
      let p = 1;
      try { if (ch && ch.check) p = w.api().pct(ch) / 100; } catch (e) {}
      const fresh = cls(b).includes('fresh'), walked = cls(b).includes('walked');
      const label = text(b);
      const talk = /설득|위협|통찰|기만|Persuasion|Intimidat|Insight|Decept|"|“/.test(label);
      const gains = ch ? [...(ch.success?.flags || []), ch.success?.flag, ...(ch.result?.flags || []), ch.result?.flag, ch.flagDirect].filter(Boolean) : [];
      const goalHit = gains.some(f => Object.values(GOAL_FLAGS).flat().includes(f) || /^f_|^lead/.test(f)) ? 1 : 0;
      const score = (ch && ch.check ? (1 - persona.risk) * p * 1.6 + persona.risk * (1 - p) * 1.0 : 0.9) + persona.curiosity * (fresh ? 0.8 : walked ? -0.5 : 0) + persona.goal * goalHit * 0.7 + persona.story * (talk ? 0.4 : 0) + r() * 0.6;
      return { b, score, label };
    }).sort((a, b) => b.score - a.score);
    const pick = scored[0];
    const choiceChars = choiceBtns.map(text).join(' ').length;
    if (choiceBtns.length >= 5) frustration += 0.01 * (1 - persona.patience); // 고를 게 많음
    think(readSec(choiceChars) * (persona.story < 0.3 ? 0.5 : 1) + 2 + 3 * (1 - persona.risk));
    click(pick.b, `선택: ${pick.label.replace(/\s+/g, ' ').slice(0, 40)}`);
  }
  if (!out.quitReason) out.quitReason = 'step limit';
  out.totalMin = w.now / 60000;
  out.scenesSeen = out.scenesSeen.size;
  return out;
}

/* ---------------- 실행·요약 ---------------- */
const personas = makePersonas(N, SEED);
const results = personas.map(p => { try { return play(p); } catch (e) { return { persona: p, crash: e.stack.split('\n').slice(0, 3).join(' | '), runs: [], errors: [], transcript: [] }; } });
const pctOf = (xs, f) => Math.round(xs.filter(f).length / Math.max(1, xs.length) * 100);
const avg = (xs, f) => xs.length ? xs.reduce((a, x) => a + f(x), 0) / xs.length : 0;
const med = (xs, f) => { const v = xs.map(f).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : 0; };
const ok = results.filter(r => !r.crash);
const summary = {
  build: html.match(/const BUILD = "([^"]+)"/)?.[1], personas: N, seed: SEED,
  crashes: results.filter(r => r.crash).map(r => ({ no: r.persona.no, crash: r.crash })),
  runtimeErrors: [...new Set(ok.flatMap(r => r.errors))].slice(0, 10),
  stuck: ok.filter(r => /^stuck/.test(r.quitReason)).map(r => ({ no: r.persona.no, where: r.quitReason })),
  medianMinutes: +med(ok, r => r.totalMin).toFixed(1),
  over15min: pctOf(ok, r => r.totalMin >= 15),
  replayed: pctOf(ok, r => r.runs.length >= 2),
  avgRuns: +avg(ok, r => r.runs.length).toFixed(2),
  reach: { ch1end: pctOf(ok, r => r.runs.some(x => x.endings.includes(1))), ch2end: pctOf(ok, r => r.runs.some(x => x.endings.includes(2))), ch3end: pctOf(ok, r => r.runs.some(x => x.endings.includes(3))), verdict: pctOf(ok, r => r.runs.some(x => x.endings.includes(4))), case2: pctOf(ok, r => r.sawCase2) },
  diedAtLeastOnce: pctOf(ok, r => r.runs.some(x => x.deaths > 0)),
  failRate: Math.round(avg(ok.flatMap(r => r.runs).filter(x => x.checks), x => x.fails / x.checks) * 100),
  timeouts: { people: pctOf(ok, r => r.timeouts > 0), total: ok.reduce((a, r) => a + r.timeouts, 0), turnedOff: pctOf(ok, r => r.timerOffBy && r.timerOffBy !== 'next') },
  objection: { tried: ok.reduce((a, r) => a + r.objections.tried, 0), won: ok.reduce((a, r) => a + r.objections.won, 0), sealed: ok.reduce((a, r) => a + r.objections.sealed, 0), retried: ok.reduce((a, r) => a + r.objections.retried, 0) },
  deductions: { tried: ok.reduce((a, r) => a + r.deductions.tried, 0), solvers: pctOf(ok, r => r.deductions.solved > 0) },
  goalsAvgPerRun: +avg(ok.flatMap(r => r.runs), x => x.goals).toFixed(2),
  readShare: Math.round(avg(ok, r => r.readMinutes / Math.max(0.1, r.totalMin)) * 100),
  quitWhere: Object.entries(ok.reduce((m, r) => { const k = r.quitReason.replace(/ @.*$/, ''); m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]),
  quitScenes: Object.entries(ok.filter(r => / @/.test(r.quitReason)).reduce((m, r) => { const k = r.quitReason.split(' @')[1]; m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8),
  longestScenes: Object.entries(ok.reduce((m, r) => { const k = r.longestScene.key; if (k) m[k] = Math.max(m[k] || 0, r.longestScene.sec); return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6),
  byArchetype: ARCHETYPES.map(a => { const g = ok.filter(r => r.persona.archetype === a.id); return { type: a.ko, n: g.length, minutes: +med(g, r => r.totalMin).toFixed(1), replay: pctOf(g, r => r.runs.length >= 2), ch3: pctOf(g, r => r.runs.some(x => x.endings.includes(3))), timeouts: g.reduce((s, r) => s + r.timeouts, 0), objWon: g.reduce((s, r) => s + r.objections.won, 0), quit: med(g, r => 0) === 0 ? Object.entries(g.reduce((m, r) => { const k = r.quitReason.replace(/ @.*$/, ''); m[k] = (m[k] || 0) + 1; return m; }, {})).sort((x, y) => y[1] - x[1])[0]?.[0] : '' }; })
};
if (TX_DIR) { fs.mkdirSync(TX_DIR, { recursive: true }); for (const r of results) fs.writeFileSync(path.join(TX_DIR, `p${String(r.persona.no).padStart(3, '0')}-${r.persona.archetype}.txt`), [`# ${r.persona.no} ${r.persona.label} (${r.persona.lang}, ${r.persona.cls}) 읽기 ${r.persona.readCps.toFixed(1)}자/초 · 인내 ${r.persona.patience.toFixed(2)} · 위험 ${r.persona.risk.toFixed(2)} · 호기심 ${r.persona.curiosity.toFixed(2)} · 추리 ${r.persona.deduction.toFixed(2)} · 시간 ${r.persona.budgetMin.toFixed(0)}분`, `결과: ${r.quitReason || r.crash} · ${(r.totalMin || 0).toFixed(1)}분 · ${r.runs.length}판`, '', ...r.transcript].join('\n')); }
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ summary, people: ok.map(r => ({ no: r.persona.no, type: r.persona.archetype, lang: r.persona.lang, cls: r.persona.cls, minutes: +r.totalMin.toFixed(1), runs: r.runs.length, quit: r.quitReason, timeouts: r.timeouts, objections: r.objections, maxChapter: r.maxChapter, case2: r.sawCase2 })) }, null, 1));
console.log(JSON.stringify(summary, null, 1));
