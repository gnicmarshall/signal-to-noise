// ============================================================
// Signal to Noise — Google Apps Script Backend
// ============================================================
// SETUP INSTRUCTIONS:
//
// 1. Go to https://script.google.com → New Project
// 2. Paste this file as Code.gs
// 3. Create a new Google Sheet and copy its ID from the URL
//    (the long string between /d/ and /edit)
// 4. Paste that ID into the SHEET_ID constant below
// 5. In the GAS editor menu: Project Settings → check
//    "Show appsscript.json manifest" → paste appsscript.json content
// 6. Create a new HTML file named "index" → paste index.html content
// 7. Run initSheets() once manually to create all tabs
// 8. Deploy → New deployment → Web app
//    - Exeåute as: Me
//    - Who has access: Only myself
// 9. Open the Web App URL
// 10. Go to Settings in the app, enter your Confluence username
//     and Personal Access Token (from wiki.corp.ebay.com → Profile → PAT)
// ============================================================

var SHEET_ID = '1nZLpc-axRgs-YH-egqYFHtjdx40KE8oXskA_O2LJHRU';
var CONFLUENCE_BASE = 'https://wiki.corp.ebay.com';

// eBay's internal Confluence uses a corporate CA that GAS doesn't trust,
// so we disable certificate validation for all internal requests.
var FETCH_OPTS = { validateHttpsCertificates: false, muteHttpExceptions: true };

// ---- Web App Entry Point ----

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Signal to Noise')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ---- Sheet Initialization ----

function initSheets() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var required = {
    'Signal':  ['id', 'text', 'completed', 'createdAt', 'source', 'confluenceTaskId'],
    'Noise':   ['id', 'text', 'timestamp'],
    'Backlog': ['id', 'text', 'source', 'status', 'createdAt', 'confluenceTaskId', 'pageTitle', 'pageUrl', 'project'],
    'RTB':     ['id', 'text', 'category', 'completedDate'],
    'Config':  ['key', 'value']
  };

  Object.keys(required).forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(required[name]);
      sheet.getRange(1, 1, 1, required[name].length).setFontWeight('bold');
    }
  });

  var config = ss.getSheetByName('Config');
  if (config.getLastRow() <= 1) {
    config.appendRow(['sessionStart', Date.now()]);
    config.appendRow(['lastSync', '']);
    config.appendRow(['confluenceUser', '']);
    config.appendRow(['watchedPageIds', '']);
  }
}

// ---- Config ----

function getConfig() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var data = ss.getSheetByName('Config').getDataRange().getValues();
  var config = {};
  for (var i = 1; i < data.length; i++) config[data[i][0]] = data[i][1];
  return config;
}

function setConfigValue(key, value) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('Config');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) { sheet.getRange(i + 1, 2).setValue(value); return; }
  }
  sheet.appendRow([key, value]);
}

// ---- Credentials (stored in Script Properties, never in Sheet) ----

function setConfluenceCredentials(user, pat) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('CONFLUENCE_USER', user);
  props.setProperty('CONFLUENCE_PAT', pat);
  setConfigValue('confluenceUser', user);
  return { success: true };
}

function getConfluenceUser() {
  return PropertiesService.getScriptProperties().getProperty('CONFLUENCE_USER') || '';
}

function hasConfluencePat() {
  var pat = PropertiesService.getScriptProperties().getProperty('CONFLUENCE_PAT');
  return !!(pat && pat.length > 0);
}

// ---- Signal Tasks ----

function getSignalTasks() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var data = ss.getSheetByName('Signal').getDataRange().getValues();
  if (data.length <= 1) return [];
  var tasks = [];
  for (var i = 1; i < data.length; i++) {
    tasks.push({
      id: data[i][0], text: data[i][1],
      completed: data[i][2] === true || data[i][2] === 'TRUE',
      createdAt: data[i][3], source: data[i][4], confluenceTaskId: data[i][5]
    });
  }
  return tasks;
}

function saveSignalTask(task) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var id = task.id || Date.now();
  ss.getSheetByName('Signal').appendRow([id, task.text, false, Date.now(), task.source || 'manual', task.confluenceTaskId || '']);
  return { id: id };
}

function updateSignalText(id, text) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('Signal');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) { sheet.getRange(i + 1, 2).setValue(text); return { success: true }; }
  }
  return { success: false };
}

function toggleSignalTask(id, completed) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('Signal');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) { sheet.getRange(i + 1, 3).setValue(completed); return { success: true }; }
  }
  return { success: false };
}

function deleteSignalTask(id) { return deleteRowById_(SHEET_ID, 'Signal', id); }

function returnToBacklog(id) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var signalSheet = ss.getSheetByName('Signal');
  var backlogSheet = ss.getSheetByName('Backlog');
  var data = signalSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      backlogSheet.appendRow([data[i][0], data[i][1], data[i][4] || 'manual', 'do', Date.now(), data[i][5] || '', '', '', '']);
      signalSheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false };
}

// ---- Noise Items ----

function getNoiseItems() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var data = ss.getSheetByName('Noise').getDataRange().getValues();
  if (data.length <= 1) return [];
  var items = [];
  for (var i = 1; i < data.length; i++) {
    items.push({ id: data[i][0], text: data[i][1], timestamp: data[i][2] });
  }
  return items;
}

function saveNoiseItem(item) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var id = Date.now();
  ss.getSheetByName('Noise').appendRow([id, item.text, id]);
  return { id: id };
}

function deleteNoiseItem(id) { return deleteRowById_(SHEET_ID, 'Noise', id); }

// ---- Backlog ----

function getBacklog() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var data = ss.getSheetByName('Backlog').getDataRange().getValues();
  if (data.length <= 1) return [];
  var items = [];
  for (var i = 1; i < data.length; i++) {
    // Hide items that are done or have been moved to Signal
    if (data[i][3] === 'done' || data[i][3] === 'signal') continue;
    items.push({
      id: data[i][0], text: data[i][1], source: data[i][2],
      status: data[i][3], createdAt: data[i][4], confluenceTaskId: data[i][5],
      pageTitle: data[i][6], pageUrl: data[i][7], project: data[i][8] || ''
    });
  }
  return items;
}

function addBacklogItem(item) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var id = Date.now();
  var validStatuses = ['do', 'chase-up', 'postpone', 'dont-do'];
  var status = validStatuses.indexOf(item.status) > -1 ? item.status : 'do';
  ss.getSheetByName('Backlog').appendRow([
    id, item.text, 'manual', status, id, '', item.pageTitle || '', item.pageUrl || '', item.project || ''
  ]);
  return { id: id };
}

function updateBacklogStatus(id, status) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('Backlog');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) { sheet.getRange(i + 1, 4).setValue(status); return { success: true }; }
  }
  return { success: false };
}

function updateBacklogText(id, text) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('Backlog');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) { sheet.getRange(i + 1, 2).setValue(text); return { success: true }; }
  }
  return { success: false };
}

function updateBacklogProject(id, project) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('Backlog');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) { sheet.getRange(i + 1, 9).setValue(project); return { success: true }; }
  }
  return { success: false };
}

function moveToSignal(id) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var backlogSheet = ss.getSheetByName('Backlog');
  var signalSheet  = ss.getSheetByName('Signal');
  var data = backlogSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      var existing = getSignalTasks();
      var active = existing.filter(function(t) { return !t.completed; });
      if (active.length >= 5) return { error: 'Maximum 5 active signal tasks. Complete or remove one first.' };
      signalSheet.appendRow([data[i][0], data[i][1], false, Date.now(), data[i][2], data[i][5]]);
      backlogSheet.getRange(i + 1, 4).setValue('signal');
      return { success: true };
    }
  }
  return { error: 'Item not found' };
}

function deleteBacklogItem(id) { return deleteRowById_(SHEET_ID, 'Backlog', id); }

// ---- RTB (Run the Business) ----
// RTB items auto-reset each day: completed is computed from completedDate == today.
// No sheet writes happen on read — toggling sets/clears the date column.

function getRtbItems() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('RTB');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var items = [];
  for (var i = 1; i < data.length; i++) {
    items.push({
      id: data[i][0], text: data[i][1],
      category: data[i][2] || 'daily',
      completed: String(data[i][3]) === today
    });
  }
  return items;
}

function addRtbItem(item) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('RTB');
  if (!sheet) return { error: 'RTB sheet not found — run initSheets() first.' };
  var id = Date.now();
  var cat = (item.category === 'morning') ? 'morning' : 'daily';
  sheet.appendRow([id, item.text, cat, '']);
  return { id: id };
}

function toggleRtbItem(id, completed) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('RTB');
  if (!sheet) return { success: false };
  var data = sheet.getDataRange().getValues();
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.getRange(i + 1, 4).setValue(completed ? today : '');
      return { success: true };
    }
  }
  return { success: false };
}

function updateRtbText(id, text) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('RTB');
  if (!sheet) return { success: false };
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) { sheet.getRange(i + 1, 2).setValue(text); return { success: true }; }
  }
  return { success: false };
}

function deleteRtbItem(id) { return deleteRowById_(SHEET_ID, 'RTB', id); }

// ---- Confluence Integration ----
// NOTE: Confluence API calls happen in the browser (index.html) because
// wiki.corp.ebay.com is an internal eBay URL unreachable from Google's servers.
// The browser fetches tasks and passes them here to save in Sheets.

function getConfluenceSettings() {
  var props = PropertiesService.getScriptProperties();
  var config = getConfig();
  return {
    pat: props.getProperty('CONFLUENCE_PAT') || '',
    user: props.getProperty('CONFLUENCE_USER') || '',
    base: CONFLUENCE_BASE,
    watchedSpaceKeys: String(config.watchedSpaceKeys || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean),
    watchedPageIds: String(config.watchedPageIds || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean)
  };
}

function saveConfluenceTasks(tasks) {
  var results = { added: 0, errors: [] };
  tasks.forEach(function(task) {
    upsertBacklogItem_(task.id, task.text, 'confluence-task', task.pageTitle, task.pageUrl, results);
  });
  setConfigValue('lastSync', new Date().toISOString());
  return results;
}

function upsertBacklogItem_(confluenceTaskId, text, source, pageTitle, pageUrl, results) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('Backlog');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][5]) === String(confluenceTaskId)) return; // already exists
  }
  var id = 'cf-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
  sheet.appendRow([id, text, source, 'backlog', Date.now(), confluenceTaskId, pageTitle, pageUrl, '']);
  results.added++;
}

// ---- Watched Pages ----

function addWatchedPage(pageUrl) {
  var match = pageUrl.match(/\/pages\/(\d+)/) || pageUrl.match(/pageId=(\d+)/);
  if (!match) return { error: 'Could not extract page ID from URL. Use the full Confluence page URL.' };
  var pageId = match[1];
  var config = getConfig();
  var current = String(config.watchedPageIds || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  if (current.indexOf(pageId) === -1) { current.push(pageId); setConfigValue('watchedPageIds', current.join(',')); }
  return { success: true, pageId: pageId };
}

function removeWatchedPage(pageId) {
  var config = getConfig();
  var current = String(config.watchedPageIds || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  setConfigValue('watchedPageIds', current.filter(function(id) { return id !== String(pageId); }).join(','));
  return { success: true };
}

function getWatchedPages() {
  var props = PropertiesService.getScriptProperties();
  var pat = props.getProperty('CONFLUENCE_PAT');
  var headers = { 'Authorization': 'Bearer ' + pat, 'Accept': 'application/json' };
  var config = getConfig();
  var ids = String(config.watchedPageIds || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  return ids.map(function(id) {
    try {
      if (!pat) return { id: id, title: id, url: '' };
      var resp = UrlFetchApp.fetch(
        CONFLUENCE_BASE + '/rest/api/content/' + id + '?fields=title,_links',
        Object.assign({}, FETCH_OPTS, { headers: headers })
      );
      if (resp.getResponseCode() === 200) {
        var data = JSON.parse(resp.getContentText());
        return {
          id: id, title: data.title || id,
          url: data._links && data._links.webui ? CONFLUENCE_BASE + data._links.webui : ''
        };
      }
    } catch(e) {}
    return { id: id, title: id, url: '' };
  });
}

// ---- Watched Spaces ----

function addWatchedSpace(spaceKey) {
  spaceKey = spaceKey.trim().replace(/^\/spaces\//i, '').split('/')[0];
  if (!spaceKey) return { error: 'Invalid space key' };
  var config = getConfig();
  var current = String(config.watchedSpaceKeys || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  if (current.indexOf(spaceKey) === -1) { current.push(spaceKey); setConfigValue('watchedSpaceKeys', current.join(',')); }
  return { success: true, spaceKey: spaceKey };
}

function removeWatchedSpace(spaceKey) {
  var config = getConfig();
  var current = String(config.watchedSpaceKeys || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  setConfigValue('watchedSpaceKeys', current.filter(function(k) { return k !== spaceKey; }).join(','));
  return { success: true };
}

function getWatchedSpaces() {
  var config = getConfig();
  var keys = String(config.watchedSpaceKeys || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  return keys.map(function(k) { return { key: k, url: CONFLUENCE_BASE + '/spaces/' + k }; });
}

// ---- Reset ----

function resetDay() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var signalSheet = ss.getSheetByName('Signal');
  var noiseSheet  = ss.getSheetByName('Noise');
  // Iterate bottom-up so row deletions don't shift the index
  var data = signalSheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    var completed = data[i][2];
    if (completed !== true && String(completed).toUpperCase() !== 'TRUE') {
      signalSheet.deleteRow(i + 1);
    }
  }
  if (noiseSheet.getLastRow() > 1) noiseSheet.deleteRows(2, noiseSheet.getLastRow() - 1);
  setConfigValue('sessionStart', Date.now());
  return { success: true };
}

// ---- Utility ----

function deleteRowById_(sheetId, sheetName, id) {
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName(sheetName);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) { sheet.deleteRow(i + 1); return { success: true }; }
  }
  return { success: false };
}

// ---- Initial Load ----

function getInitialData() {
  var config = getConfig();
  return {
    signal: getSignalTasks(),
    noise: getNoiseItems(),
    backlog: getBacklog(),
    rtb: getRtbItems(),
    config: config,
    confluenceUser: getConfluenceUser(),
    hasPat: hasConfluencePat()
  };
}
