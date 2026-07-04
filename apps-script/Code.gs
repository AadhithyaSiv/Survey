/**
 * Google Apps Script — collector for the "A study on how we decide" survey.
 * =========================================================================
 * It receives each completed survey (a JSON payload POSTed by the web app),
 * flattens it into one row, and writes it to a sheet named "Responses".
 *
 * HOW TO DEPLOY (once):
 *   1. Open your Google Sheet.
 *   2. Extensions  ▸  Apps Script.
 *   3. Delete anything in the editor, paste this whole file, click Save.
 *   4. Deploy  ▸  New deployment  ▸  gear icon ▸  "Web app".
 *   5. Description: anything. Execute as: "Me". Who has access: "Anyone".
 *   6. Deploy  ▸  Authorize access  ▸  allow.
 *   7. Copy the "Web app" URL (it ends in /exec).
 *   8. Paste that URL into CONFIG.endpoint in constellation-experience.html.
 *
 * Notes:
 *   - Headers are created automatically from the first submission and grow
 *     on their own if new fields ever appear — you never hand-maintain columns.
 *   - Rows are keyed by respondentId (upsert): if the same person's survey is
 *     re-sent (e.g. they reopened a finished link), the existing row is updated
 *     instead of duplicated.
 *   - Re-deploy note: after editing this script, use Deploy ▸ Manage deployments
 *     ▸ edit ▸ Version: "New version" so the live URL runs your latest code.
 */

const SHEET_NAME = 'Responses';
const ID_COLUMN  = 'respondentId';   // upsert key

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);              // serialize concurrent submissions
  try {
    const data = JSON.parse(e.postData.contents);
    writeRow(flatten(data));
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Lets you open the /exec URL in a browser to confirm it's live.
function doGet() {
  return json({ ok: true, service: 'wdmi-survey-collector' });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* --------------------------------------------------------------------------
 * Flatten one payload into a flat { columnName: value } object.
 * Column naming (analysis-friendly):
 *   receivedAt, studyId, respondentId, theme, startedAt, completedAt
 *   consent_participate, consent_shareAnonymised, consent_at
 *   belief_coded, belief_text
 *   demo_<field>                    (age, gender, ...)
 *   <ITEM_CODE>                     the answer in words, e.g. "Agree"  (e.g. MACH_01)
 *   <ITEM_CODE>_rt                  reaction time in ms
 *   <SJT_CODE>, <SJT_CODE>_w        chosen SJT option (full text) + its weight
 *   score_<name> / score_<name>_<sub>   computed scores
 * ------------------------------------------------------------------------ */
function flatten(p) {
  const r = {};
  r.receivedAt   = new Date();
  r.studyId      = p.studyId || '';
  r.respondentId = p.respondentId || '';
  r.theme        = p.theme || '';
  r.startedAt    = p.startedAt || '';
  r.completedAt  = p.completedAt || '';

  const c = p.consent || {};
  r.consent_participate     = c.participate;
  r.consent_shareAnonymised = c.shareAnonymised;
  r.consent_at              = c.at || '';

  const af = p.AF_00 || {};
  r.belief_coded = af.belief_coded;
  r.belief_text  = af.belief_text || '';

  const d = p.demographics || {};
  Object.keys(d).forEach(function (k) { r['demo_' + k] = d[k]; });

  const resp = p.responses || {};
  Object.keys(resp).forEach(function (code) {
    const a = resp[code] || {};
    if (a.choice !== undefined) {          // SJT scenario
      r[code]        = (a.text !== undefined) ? a.text : a.choice;  // the option they chose, in words
      r[code + '_w'] = a.weight;           // its numeric weight (for scoring)
    } else {                               // Likert / numeric item
      r[code] = (a.label !== undefined) ? a.label : a.raw;          // the answer in words (e.g. "Agree")
    }
    if (a.rtMs !== undefined) r[code + '_rt'] = a.rtMs;
  });

  const s = p.scores || {};
  Object.keys(s).forEach(function (k) {
    const v = s[k];
    if (v && typeof v === 'object') {      // nested marker/subscale objects
      Object.keys(v).forEach(function (sub) { r['score_' + k + '_' + sub] = v[sub]; });
    } else {
      r['score_' + k] = v;
    }
  });

  return r;
}

/* --------------------------------------------------------------------------
 * Write one flat row: create/extend the header row as needed, then upsert
 * by respondentId (update existing row, else append).
 * ------------------------------------------------------------------------ */
function writeRow(row) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  let headers = sh.getLastColumn()
    ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    : [];

  // Add any columns this payload introduces that we've never seen.
  const newCols = Object.keys(row).filter(function (k) { return headers.indexOf(k) === -1; });
  if (!headers.length || newCols.length) {
    headers = headers.concat(newCols);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }

  const values = headers.map(function (h) { return row[h] === undefined ? '' : row[h]; });

  // Upsert by respondentId.
  const idCol = headers.indexOf(ID_COLUMN);
  let targetRow = 0;
  if (idCol !== -1 && row[ID_COLUMN] && sh.getLastRow() > 1) {
    const ids = sh.getRange(2, idCol + 1, sh.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (ids[i][0] === row[ID_COLUMN]) { targetRow = i + 2; break; }
    }
  }

  if (targetRow) sh.getRange(targetRow, 1, 1, values.length).setValues([values]);
  else sh.appendRow(values);
}
