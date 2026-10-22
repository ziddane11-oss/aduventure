/**
 * 어두밴처 — 붉은 쪽지 읽기 (Apps Script)
 *
 * 붙이는 법
 * 1. 피드백 시트의 Apps Script 편집기를 연다.
 * 2. 편집기의 코드를 전부 지우고 이 파일 전체를 붙여 넣는다.
 *    doPost(기록 저장)와 doGet(쪽지 읽기)이 모두 들어 있다. 둘 중 하나라도 빠지면 게임 기록이 끊긴다.
 * 3. 배포 → 배포 관리 → 연필 → 버전: "새 버전" → 배포. (저장만 하면 반영되지 않는다.)
 * 4. 브라우저에서 <웹 앱 주소>?action=notes 를 열어 {"ok":true,"notes":[...]} 가 나오면 끝.
 *    <웹 앱 주소>?action=stats 는 {"ok":true,"stats":{...}} (다른 기록관의 선택 비율, pt27).
 *
 * 안전: 쪽지는 게임이 정한 단어 id 조합만 통과시킨다. 자유 문장은 저장돼 있어도 내보내지 않는다.
 */
var NOTE_SHEET_ID = '1HQqM3aSczT6zHXxLF3ZpbmzQF9v-geX_89nkyy8fyT8'; // '어두벤처 응답'
var NOTE_SHEET_NAME = '응답';
var NOTE_WORDS = {
  s: ['ren', 'lens', 'bern', 'seon', 'scully', 'ledger', 'letters', 'wire', 'keys', 'record'],
  v: ['trust', 'doubt', 'keep', 'drop', 'remember'],
  r: ['none', 'gear', 'ledger', 'letters', 'window', 'hand', 'water']
};
var NOTE_SCAN_ROWS = 3000;   // 최근 행만 훑는다
var NOTE_PER_SCENE = 3;      // 장면당 최근 쪽지 수(게임은 2개만 보여 준다)

var STATS_SCAN_ROWS = 8000;  // 선택 비율: 최근 행만 센다
var STATS_CACHE_SEC = 600;   // 10분 캐시(시트를 매번 읽지 않는다)

function doGet(e) {
  var p = (e && e.parameter) || {};
  var body;
  if (p.action === 'notes') body = JSON.stringify({ ok: true, notes: readNotes_() });
  else if (p.action === 'stats') body = statsBody_();
  else return ContentService.createTextOutput('alive');
  var cb = String(p.callback || '');
  if (/^adu(Notes|Stats)\d{1,10}$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + body + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function readNotes_() {
  var sheet = SpreadsheetApp.openById(NOTE_SHEET_ID).getSheetByName(NOTE_SHEET_NAME);
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var start = Math.max(2, last - NOTE_SCAN_ROWS + 1);
  var rows = sheet.getRange(start, 1, last - start + 1, 6).getValues(); // 시각, 유형, 장면, 이름, 내용, extra
  var perScene = {}, out = [];
  for (var i = rows.length - 1; i >= 0; i--) {
    var row = rows[i];
    if (String(row[1]) !== 'note') continue;
    var scene = String(row[2] || '');
    if (!/^[a-zA-Z0-9]{1,24}$/.test(scene)) continue;
    var x;
    try { x = JSON.parse(String(row[5] || '')); } catch (err) { continue; }
    if (!x || NOTE_WORDS.s.indexOf(x.s) < 0 || NOTE_WORDS.v.indexOf(x.v) < 0 || NOTE_WORDS.r.indexOf(x.r || 'none') < 0) continue;
    perScene[scene] = (perScene[scene] || 0) + 1;
    if (perScene[scene] > NOTE_PER_SCENE) continue;
    var no = Number(x.no);
    out.push({ scene: scene, s: x.s, v: x.v, r: x.r || 'none', no: no > 0 && no < 1e7 ? Math.floor(no) : null });
  }
  return out;
}

// ---- 선택 비율: telemetry 'choice' 행의 choice_id("장면:번호")를 판(run_id)마다 한 번씩 센다 ----
function statsBody_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('stats_v1');
  if (hit) return hit;
  var body = JSON.stringify({ ok: true, stats: readStats_() });
  if (body.length < 90000) cache.put('stats_v1', body, STATS_CACHE_SEC);
  return body;
}

function readStats_() {
  var sheet = SpreadsheetApp.openById(NOTE_SHEET_ID).getSheetByName(NOTE_SHEET_NAME);
  var last = sheet.getLastRow();
  if (last < 2) return {};
  var start = Math.max(2, last - STATS_SCAN_ROWS + 1);
  var rows = sheet.getRange(start, 1, last - start + 1, 6).getValues(); // 시각, 유형, 장면, 이름, 내용, extra
  var seen = {}, out = {};
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (String(row[1]) !== 'telemetry' || String(row[4]) !== 'choice') continue;
    var x;
    try { x = JSON.parse(String(row[5] || '')); } catch (err) { continue; }
    var id = x && String(x.choice_id || '');
    var m = /^([a-zA-Z0-9_]{1,24}):(\d{1,2})$/.exec(id);
    if (!m) continue; // timeout:·skip: 등은 세지 않는다
    var key = String(x.run_id || '') + '|' + id;
    if (seen[key]) continue;
    seen[key] = true;
    out[m[1]] = out[m[1]] || {};
    out[m[1]][m[2]] = (out[m[1]][m[2]] || 0) + 1;
  }
  return out;
}

// ---- 기록 저장: 게임의 gasPost({type, scene, who, text, extra})를 '응답' 시트 한 줄로 적는다 ----
function doPost(e) {
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var extra = d.extra;
    if (extra && typeof extra !== 'string') extra = JSON.stringify(extra);
    var sheet = SpreadsheetApp.openById(NOTE_SHEET_ID).getSheetByName(NOTE_SHEET_NAME);
    sheet.appendRow([new Date(), cell_(d.type, 40), cell_(d.scene, 80), cell_(d.who, 80), cell_(d.text, 5000), cell_(extra, 5000)]);
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error');
  }
}

// 시트가 '='·'+'·'-'·'@'로 시작하는 값을 수식으로 읽지 않게 막는다(#ERROR! 방지).
function cell_(v, max) {
  var s = v == null ? '' : String(v).slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
