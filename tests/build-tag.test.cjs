const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// 정적 <title>은 JS 실행 전·링크 미리보기에 노출되므로 BUILD와 같아야 한다
test('정적 title의 빌드 태그가 BUILD 상수와 일치한다', () => {
  const build = html.match(/const BUILD = "([^"]+)"/)[1];
  const title = html.match(/<title>([^<]*)<\/title>/)[1];
  assert.equal(title, `어두밴처 ${build}`);
});
