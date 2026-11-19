/**
 * FITTER v2 - 구글 시트 JSON API
 * 기존 시트(운동기록_DB, 커스텀종목_DB)를 그대로 사용합니다.
 * 화면(index.html)은 더 이상 필요 없고, 이 파일만 "웹 앱"으로 배포하면 됩니다.
 *  - 실행 사용자: 나 / 액세스 권한: 모든 사용자
 */
const SHEET_NAME = '운동기록_DB';
const CUSTOM_SHEET_NAME = '커스텀종목_DB';
const HEADERS = ['ID', '날짜', '분할 루틴', '운동 종목', '세트 정보', '작성 시각', '메모'];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const p = body.payload || {};
    const actions = {
      getLogs: () => getLogs(),
      addLog: () => addLog(p),
      updateLog: () => updateLog(p),
      deleteLog: () => deleteLog(p.id),
      getCustomExercises: () => getCustomExercises(),
      addCustomExercise: () => addCustomExercise(p.routine, p.exercise),
    };
    if (!actions[body.action]) throw new Error('알 수 없는 action: ' + body.action);
    return json({ ok: true, data: actions[body.action]() });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet() {
  return json({ ok: true, data: 'FITTER API is running' });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function tz() { return Session.getScriptTimeZone(); }

function logSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < HEADERS.length) {
    sh.getRange(1, HEADERS.length).setValue('메모'); // 기존 시트에 메모 열 추가
  }
  return sh;
}

function customSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CUSTOM_SHEET_NAME) || ss.insertSheet(CUSTOM_SHEET_NAME);
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, 2).setValues([['분할 루틴', '운동 종목']]).setFontWeight('bold');
  return sh;
}

function fmtDate(v) {
  return v instanceof Date ? Utilities.formatDate(v, tz(), 'yyyy-MM-dd') : String(v);
}
function fmtTime(v) {
  return v instanceof Date ? Utilities.formatDate(v, tz(), 'yyyy-MM-dd HH:mm:ss') : String(v);
}

function getLogs() {
  const sh = logSheet();
  const n = sh.getLastRow() - 1;
  if (n <= 0) return [];
  return sh.getRange(2, 1, n, HEADERS.length).getValues().map(function (r) {
    let sets = [];
    try { sets = JSON.parse(r[4]); } catch (e) {}
    return {
      id: String(r[0]), date: fmtDate(r[1]), routine: String(r[2]), exercise: String(r[3]),
      sets: sets, createdAt: fmtTime(r[5]), memo: r[6] ? String(r[6]) : undefined,
    };
  });
}

function addLog(log) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const id = 'LOG_' + Date.now();
    const createdAt = Utilities.formatDate(new Date(), tz(), 'yyyy-MM-dd HH:mm:ss');
    // 날짜는 '문자열'로 저장해 시간대 변환 문제 방지
    logSheet().appendRow([id, "'" + log.date, log.routine, log.exercise, JSON.stringify(log.sets), createdAt, log.memo || '']);
    return Object.assign({}, log, { id: id, createdAt: createdAt });
  } finally {
    lock.releaseLock();
  }
}

function findRow(sh, id) {
  const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (let i = 1; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 1;
  throw new Error('기록을 찾을 수 없습니다: ' + id);
}

function updateLog(log) {
  const sh = logSheet();
  const row = findRow(sh, log.id);
  sh.getRange(row, 2, 1, 4).setValues([["'" + log.date, log.routine, log.exercise, JSON.stringify(log.sets)]]);
  sh.getRange(row, 7).setValue(log.memo || '');
  return true;
}

function deleteLog(id) {
  const sh = logSheet();
  sh.deleteRow(findRow(sh, id));
  return true;
}

function getCustomExercises() {
  const sh = customSheet();
  const n = sh.getLastRow() - 1;
  if (n <= 0) return [];
  return sh.getRange(2, 1, n, 2).getValues().map(function (r) { return { routine: String(r[0]), exercise: String(r[1]) }; });
}

function addCustomExercise(routine, exercise) {
  customSheet().appendRow([routine, exercise]);
  return true;
}
