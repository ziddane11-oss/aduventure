// pt49.1 — 실제 피드백 폼 입력·전송으로 재플레이 설문과 기존 검증을 함께 확인한다.
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
  return [node, ...(node.children || []).flatMap(nodes)];
}
function text(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(text).join('');
  return typeof node === 'object' ? text(node.children) : String(node);
}
function harness({lang = 'en', sceneKey} = {}) {
  const states = [], sent = [], copies = [];
  let cursor = 0;
  const data = new Map([['aduventure_lang', JSON.stringify(lang)]]);
  const ctx = vm.createContext({
    console, Date, Math, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    window: {addEventListener() {}}, document: {documentElement: {}},
    navigator: {clipboard: {writeText: v => { copies.push(v); return Promise.resolve(); }}},
    fetch: async (url, init) => { if (init?.body) sent.push(JSON.parse(init.body)); return {text: async () => 'ok'}; },
    localStorage: {getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k)},
    React: {
      Fragment: 'fragment', createElement: (type, props, ...children) => ({type, props: props || {}, children}),
      useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], v => states[i] = typeof v === 'function' ? v(states[i]) : v]; },
      useRef(initial) { const i = cursor++; if (!(i in states)) states[i] = {current: initial}; return states[i]; },
      useEffect() {}
    }
  });
  vm.runInContext(app, ctx);
  ctx.surveyLang = lang;
  vm.runInContext(`globalThis.surveyProps = {ui: k => UI[k][surveyLang], build: BUILD, session: {lang: surveyLang, reached: ['intro','ending'], stop: 'ending', minutes: 7}, onClose() {}}`, ctx);
  const render = () => { cursor = 0; return vm.runInContext(sceneKey ? 'CRPG()' : 'PlaytestFeedback(surveyProps)', ctx); };
  if (sceneKey) {
    data.set('aduventure_save', JSON.stringify({v: 1, sceneKey, flags: [], ruleKey: 'srd20', fate: 1, specialLeft: 2, breathLeft: 1, tutSeen: true, runNo: 113,
      pc: {...vm.runInContext('CLASSES.fighter', ctx), classKey: 'fighter', name: 'QA'}, stats: {rolls: 0, success: 0}}));
    nodes(render()).find(n => n.props.className === 'continueBtn').props.onClick();
  }
  const field = (name, value) => nodes(render()).find(n => n.props.name === name && (value === undefined || String(n.props.value) === String(value)));
  const write = (name, value) => { const f = field(name); assert.ok(f, `Missing field: ${name}`); f.props.onChange({target: {value}}); };
  const pick = (name, value) => { const f = field(name, value); assert.ok(f, `Missing option: ${name}=${value}`); f.props.onChange({target: {value, checked: !f.props.checked}}); };
  const submit = async () => { nodes(render()).find(n => n.props.className === 'fbPrimary').props.onClick(); await new Promise(resolve => setImmediate(resolve)); };
  return {render, field, write, pick, submit, sent, copies,
    feedback: () => sent.filter(p => p.type === 'playtest_feedback'),
    run: code => vm.runInContext(code, ctx),
    language(value) { ctx.surveyLang = value; ctx.surveyProps.session.lang = value; }
  };
}

for (const lang of ['ko', 'en']) {
  test(`${lang}: 새 설문 전체와 기존 응답이 summary/extra.answers에 함께 전송된다`, async () => {
    const g = harness({lang});
    g.pick('choiceHad', 'none'); g.pick('quitHad', 'forgot');
    g.write('combat', 'I chose to parry.'); g.write('confuse', 'The gear.'); g.write('more', 'Find S.'); g.write('bug', 'No bug.');
    g.pick('replayWant', 'now'); g.write('replayWhy', 'Another route.'); g.write('replayDiff', 'Play a wizard.'); g.write('funOne', 'Shorten the opening.');
    g.pick('replayDrivers', 'class_path'); g.pick('replayDrivers', 'secrets'); g.pick('replayDrivers', 'other');
    g.write('replayDriversOther', 'Co-op.'); g.pick('comeBack', 4); g.pick('pay3', 'maybe'); g.write('tester', 'u/test_archivist');
    await g.submit();
    const [payload] = g.feedback();
    assert.ok(payload);
    const extra = JSON.parse(payload.extra);
    assert.equal(payload.type, 'playtest_feedback'); assert.equal(payload.scene, 'ending');
    assert.equal(extra.lang, lang); assert.equal(extra.stop, 'ending'); assert.deepEqual(extra.reached, ['intro','ending']); assert.equal(extra.minutes, 7);
    assert.deepEqual(payload.answers, extra.answers);
    const expected = {choiceHad: 'none', quitHad: 'forgot', combat: 'I chose to parry.', confuse: 'The gear.', more: 'Find S.', bug: 'No bug.', replayWant: 'now', replayWhy: 'Another route.', replayDiff: 'Play a wizard.', funOne: 'Shorten the opening.', replayDrivers: ['class_path','secrets','other'], replayDriversOther: 'Co-op.', comeBack: 4, pay3: 'maybe', tester: 'u/test_archivist'};
    for (const [k,v] of Object.entries(expected)) assert.deepEqual(extra.answers[k], v, k);
    assert.equal(extra.answers.choice, g.run(`UI.fbHadNone.${lang}`));
    assert.equal(extra.answers.quit, g.run(`UI.fbHadForgot.${lang}`));
    for (const k of ['replayWant','replayWhy','replayDiff','funOne','replayDrivers','replayDriversOther','comeBack','pay3','tester']) assert.ok(payload.text.includes(`[${k}]`), `${k} missing in text summary`);
    for (const v of ['Another route.', 'Play a wizard.', 'Shorten the opening.', 'Co-op.', 'u/test_archivist']) assert.ok(payload.text.includes(v));
    nodes(g.render()).find(n => n.type === 'button' && text(n) === g.run(`UI.fbCopy.${lang}`)).props.onClick();
    assert.equal(g.copies[0], payload.text, '복사와 서버 요약이 같다');
  });
  test(`${lang}: 설문 라벨·선택지가 번역되고 이름 있는 필드와 접근 가능한 그룹으로 연결된다`, () => {
    const g = harness({lang});
    const tree = g.render();
    for (const [name, values] of [['replayWant',['now','later','no']], ['replayDrivers',['endings','class_path','harder','secrets','daily','shorter','other']], ['comeBack',[1,2,3,4,5]], ['pay3',['yes','maybe','no']]]) {
      const group = nodes(tree).find(n => n.type === 'fieldset' && nodes(n).some(c => c.props.name === name));
      assert.ok(group, `${name} fieldset`); assert.ok(text(nodes(group).find(n => n.type === 'legend')), `${name} legend`);
      for (const value of values) {
        const input = nodes(group).find(n => n.props.name === name && String(n.props.value) === String(value));
        assert.ok(input, `${name}=${value}`); assert.equal(input.props.type, name === 'replayDrivers' ? 'checkbox' : 'radio');
        assert.ok(nodes(group).some(n => n.type === 'label' && nodes(n).includes(input) && text(n).trim()), `${name}=${value} label`);
      }
    }
    for (const name of ['replayWhy','replayDiff','funOne','tester']) {
      const input = g.field(name); assert.ok(input);
      assert.ok(nodes(tree).some(n => n.type === 'label' && nodes(n).some(c => c.props.name === name) && text(n).trim()), name + ' label');
    }
    if (lang === 'en') assert.ok(!/[가-힣]/.test(text(tree)), text(tree));
  });
  test(`${lang}: 첫 판 1장 엔딩의 접히지 않은 30초 설문 버튼으로 폼을 연다`, () => {
    const g = harness({lang, sceneKey: 'ending'});
    const tree = g.render();
    const label = lang === 'ko' ? '30초 설문' : '30-second survey';
    const button = nodes(tree).find(n => n.type === 'button' && text(n) === label);
    assert.ok(button);
    assert.ok(!nodes(tree).filter(n => n.type === 'details').some(n => nodes(n).includes(button)), '접힌 정리 안에 숨기지 않는다');
    button.props.onClick();
    const modal = nodes(g.render()).find(n => typeof n.type === 'function' && n.type.name === 'PlaytestFeedback');
    assert.ok(modal); assert.equal(modal.props.session.stop, 'ending'); assert.equal(modal.props.session.lang, lang);
  });
}

test('새 질문 한 가지만 답해도 제출되고 응답하지 않은 질문은 빈 값으로 남는다', async () => {
  for (const [name, value, kind] of [['replayWant','no','pick'], ['replayWhy','No time.'], ['replayDiff','Try another class.'], ['funOne','Fewer words.'], ['replayDrivers','daily','pick'], ['comeBack',1,'pick'], ['pay3','no','pick'], ['tester','tester42']]) {
    const g = harness(); g[kind === 'pick' ? 'pick' : 'write'](name, value); await g.submit();
    const [payload] = g.feedback(); assert.ok(payload, name);
    assert.equal(payload.answers.choiceHad, ''); assert.equal(payload.answers.quitHad, '');
    assert.deepEqual(payload.answers[name], name === 'replayDrivers' ? [value] : value);
  }
});

test('빈 응답과 기존 있었다 상세 검증은 새 답변이 있어도 유지한다', async () => {
  const empty = harness(); await empty.submit(); assert.equal(empty.feedback().length, 0);
  assert.ok(text(empty.render()).includes(empty.run('UI.fbEmpty.en')));
  const oldOnly = harness(); oldOnly.pick('choiceHad', 'none'); await oldOnly.submit();
  assert.equal(oldOnly.feedback().length, 1, '기존 질문 하나만 답해도 제출 가능');
  assert.equal(oldOnly.feedback()[0].answers.replayWant, '');
  assert.deepEqual(oldOnly.feedback()[0].answers.replayDrivers, []);
  assert.equal(oldOnly.feedback()[0].answers.comeBack, '');
  assert.equal(oldOnly.feedback()[0].answers.pay3, '');
  assert.equal(oldOnly.feedback()[0].answers.tester, '');
  for (const prefix of ['choice', 'quit']) {
    const g = harness(); g.pick(prefix + 'Had', 'yes'); g.pick('replayWant', 'later'); await g.submit();
    assert.equal(g.feedback().length, 0); assert.ok(text(g.render()).includes(g.run('UI.fbNeedDetail.en')));
    g.write(prefix + 'Where', 'The lighthouse.'); await g.submit();
    assert.equal(g.feedback().length, 1, '기존 규칙대로 위치나 이유 중 하나면 제출 가능');
  }
});

test('복수 선택의 해제·기타 입력·언어 전환이 값을 덮어쓰거나 숨은 기타 내용을 전송하지 않는다', async () => {
  const g = harness();
  g.pick('replayDrivers', 'endings'); g.pick('replayDrivers', 'harder'); g.pick('replayDrivers', 'other'); g.write('replayDriversOther', 'A friend mode.');
  g.pick('replayDrivers', 'harder');
  g.language('ko');
  assert.equal(g.field('replayDrivers', 'endings').props.checked, true);
  assert.equal(g.field('replayDrivers', 'harder').props.checked, false);
  assert.equal(g.field('replayDriversOther').props.value, 'A friend mode.');
  g.pick('replayDrivers', 'other');
  assert.equal(g.field('replayDriversOther'), undefined);
  await g.submit();
  const payload = g.feedback()[0];
  assert.deepEqual(payload.answers.replayDrivers, ['endings']); assert.equal(payload.answers.replayDriversOther, '');
  assert.ok(!payload.text.includes('A friend mode.')); assert.equal(payload.lang, 'ko');
});
