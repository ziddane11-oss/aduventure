// pt36 — 시즌 1 피날레 「제113호」: 사건 1·2의 붉은 손(지도를 그린 손·이름을 적은 손·돈을 낸 손)을 한데 모은다.
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
    globalThis.api = {sceneKey, flags, fate, goto, doChoice, scene};
    const pct = choice =>`), ctx);
  data.set('aduventure_save', JSON.stringify({
    v: 1, sceneKey, flags, ruleKey: 'srd20', fate: 1, specialLeft: 2, breathLeft: 1, tutSeen: true, runNo: 130,
    pc: {...vm.runInContext('CLASSES.fighter', ctx), hp: 12, classKey: 'fighter', name: 'QA'}, stats: {rolls: 0, success: 0}
  }));
  const render = () => { index = 0; return vm.runInContext('CRPG()', ctx); };
  nodes(render()).find(n => n.props.className === 'continueBtn').props.onClick();
  const goals = () => expand(render(), 'GoalBox');
  const panel = () => expand(render(), 'ObjectionPanel');
  const card = () => { const el = nodes(render()).find(n => typeof n.type === 'function' && n.type.name === 'RecordCard'); return el.props.record; };
  const press = (cls, pick = 0) => nodes(panel()).filter(n => n.type === 'button' && n.props.className === cls)[pick].props.onClick();
  return {data, render, goals, panel, card, press, run: c => vm.runInContext(c, ctx), state: () => { render(); return ctx.api; }};
}

const choiceBtns = tree => nodes(tree).filter(n => n.type === 'button' && /^choice( |$)/.test(n.props.className));
const press = (g, re) => { const b = choiceBtns(g.render()).find(n => re.test(text(n))); assert.ok(b, 'button ' + re); b.props.onClick(); return g.state(); };


const restartBtns = tree => nodes(tree).filter(n => n.type === 'button' && /^restart/.test(n.props.className));

test('사건 2가 끝나면 「계속」은 시즌 1 피날레로 간다', () => {
  for (const [lang, re] of [['en', /Season 1 Finale/], ['ko', /시즌 1 피날레/]]) {
    const g = game({sceneKey: 'c2_end3', flags: ['c2_expose', 'c2_many'], lang});
    const primary = restartBtns(g.render()).find(n => n.props.className === 'restart primary');
    assert.match(text(primary), re);
    primary.props.onClick();
    assert.equal(g.state().sceneKey, 'fin_intro');
  }
});

test('첫 장면: 사건 1의 판결에 따라 다른 사람이 서고로 안내한다', () => {
  for (const [verdict, re] of [['accuseSeon', /^\[Prison\]/], ['dealSeon', /^\[Seon's Man\]/], ['accuseBern', /^\[Bern\]/]]) {
    const g = game({sceneKey: 'fin_intro', flags: [verdict, 'c2_many']});
    const labels = choiceBtns(g.render()).map(text);
    assert.ok(labels.some(l => re.test(l)), verdict + ': ' + labels.join(' | '));
    assert.ok(labels.some(l => /^Go straight/.test(l)), '판결과 상관없는 길도 있다');
    const s = press(g, re);
    assert.equal(s.sceneKey, 'fin_archive');
  }
});

test('서고: 먹울에서 외운 번호나 열쇠 꼬리표 글씨가 있으면 그 기억으로 바로 안다', () => {
  const g = game({sceneKey: 'fin_archive', flags: ['c2_memorized', 'f_hand_match']});
  const labels = choiceBtns(g.render()).map(text);
  assert.ok(labels.some(l => /^\[Memory\]/.test(l)) && labels.some(l => /^\[Handwriting\]/.test(l)));
  let s = press(g, /^\[Memory\]/);
  assert.equal(s.sceneKey, 'fin_council');
  assert.ok([...s.flags].includes('fin_council') && [...s.flags].includes('fin_gap'));
  const h = game({sceneKey: 'fin_archive', flags: ['f_hand_match']});
  s = press(h, /^\[Handwriting\]/);
  assert.ok([...s.flags].includes('fin_prev'));
  const plain = game({sceneKey: 'fin_archive', flags: []});
  assert.ok(!choiceBtns(plain.render()).some(b => /^\[(Memory|Handwriting)\]/.test(text(b))), '기억이 없으면 그 길은 안 보인다');
});

test('마지막 선택: [붉은 여백]은 정서비 지출부를 찾아야 열리고, 찾으면 진실의 결말', () => {
  const locked = game({sceneKey: 'fin_sign', flags: ['c2_many']});
  const red = choiceBtns(locked.render()).find(b => /^\[Red Margin\]/.test(text(b)));
  assert.ok(red, '잠겨도 보인다(막다른 길 방지)');
  assert.ok(red.props.disabled, '증거 없이는 잠김');
  const open = game({sceneKey: 'fin_sign', flags: ['c2_many', 'fin_council'], lore: ['fin_council']});
  const s = press(open, /^\[Red Margin\]/);
  assert.equal(s.sceneKey, 'fin_end');
  assert.ok([...s.flags].includes('fin_red'));
});

test('[낭독]은 이레가 곁에 남았을 때만 — 묵과 거래했다면 없다', () => {
  assert.ok(choiceBtns(game({sceneKey: 'fin_sign', flags: ['c2_many', 'c2_keep']}).render()).some(b => /^\[Reading\]/.test(text(b))));
  assert.ok(!choiceBtns(game({sceneKey: 'fin_sign', flags: ['c2_many', 'c2_dealMuk']}).render()).some(b => /^\[Reading\]/.test(text(b))));
  const g = game({sceneKey: 'fin_sign', flags: ['c2_many', 'c2_keep']});
  assert.ok([...press(g, /^\[Reading\]/).flags].includes('fin_read'));
});

for (const [flag, badge, sign] of [['fin_red', '8r', /Recorded by: QA/], ['fin_read', '8l', /Recorded by: QA/], ['fin_clean', '8c', /Recorder QA/]]) {
  test(`피날레 엔딩(${flag}): 공식 기록·버튼·배지가 모두 맞다`, () => {
    for (const lang of ['ko', 'en']) {
      const g = game({sceneKey: 'fin_end', flags: [flag, 'fin_prev', 'fin_ren', 'fin_council'], lang});
      const tree = g.render();
      const narr = nodes(tree).find(n => n.props.className === 'narr');
      if (lang === 'en') {
        assert.ok(!HANGUL.test(text(narr)), text(narr));
        assert.match(text(narr), /Season 1 Finale/);
        const rec = g.card();
        assert.match(g.run(`fmt(${JSON.stringify(rec.signer.en)}, {name: "QA"})`), sign);
        for (const l of rec.lines) assert.ok(!HANGUL.test(l.en), l.en);
      }
      const btns = restartBtns(tree);
      assert.match(text(btns.find(b => b.props.className === 'restart primary')), lang === 'en' ? /Replay the finale/ : /피날레 다시/);
      assert.ok(nodes(tree).some(n => n.props.className === 'caseStatus' && (lang === 'en' ? /Season 2/ : /시즌 2/).test(text(n))));
    }
    assert.equal(game({sceneKey: 'fin_end'}).run(`badgeId(8, ${JSON.stringify([flag])})`), badge);
  });
}

test('피날레의 모든 글(장면·선택지·결과·배지·기록 범위)은 한/영 둘 다 있고 영어에 한국어가 섞이지 않는다', () => {
  const g = game({sceneKey: 'fin_intro'});
  const strings = g.run(`(() => {
    const out = [];
    const walk = v => { if (!v || typeof v !== 'object') return; if (typeof v.ko === 'string' && 'en' in v) { out.push(v); return; } Object.values(v).forEach(walk); };
    walk(['fin_intro','fin_archive','fin_council','fin_sign'].map(k => SCENES[k]));
    walk(['fin_intro','fin_archive','fin_council','fin_sign','fin_end'].map(k => SCENE_TITLES[k]));
    walk(['fin_intro','fin_archive','fin_council','fin_sign'].map(k => SCENE_DOING[k]));
    walk(BADGES.filter(b => /^8/.test(b.id)));
    walk(['finNext','finCh','finAgain','finDone','c2Done'].map(k => UI[k]));
    walk(CLUES.fin_council);
    for (const f of [['fin_red'],['fin_read'],['fin_clean'],['fin_council','fin_prev']]) walk(chapterLedger(8, f));
    return out;
  })()`);
  assert.ok(strings.length > 50, String(strings.length));
  for (const s of strings) { assert.ok(s.ko && s.en, JSON.stringify(s)); assert.ok(!HANGUL.test(s.en), s.en); }
});

test('피날레 장면은 어디서도 막히지 않는다 — 모든 갈래가 다음 장면이나 엔딩으로 간다', () => {
  const g = game({sceneKey: 'fin_intro'});
  const targets = g.run(`['fin_intro','fin_archive','fin_council','fin_sign'].flatMap(k => SCENES[k].choices.flatMap(c => [c.goto, c.success?.goto, c.fail?.goto, c.result?.goto].filter(Boolean)))`);
  for (const t of targets) assert.ok(g.run(`!!SCENES[${JSON.stringify(t)}]`), t);
  assert.equal(g.run('CHAPTER_START[8]'), 'fin_intro');
  assert.ok(g.run('MID_ENDINGS.includes(7) && !MID_ENDINGS.includes(8)'), '사건 2 끝은 멈춰도 이어지고, 피날레 끝은 판의 끝');
});
