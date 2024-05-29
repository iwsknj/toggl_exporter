/*
  Toggl time entries export to GoogleCalendar
  author: Masato Kawaguchi
  Released under the MIT license
  version: 1.0.2
  https://github.com/mkawaguchi/toggl_exporter/blob/master/LICENSE

  required: moment.js
    project-key: 15hgNOjKHUG4UtyZl9clqBbl23sDvWMS8pfDJOyIapZk5RBqwL3i-rlCo
*/

const CACHE_KEY          = 'toggl_exporter:lastmodify_datetime';
const TIME_OFFSET        = 9 * 60 * 60; // JST
const TOGGL_API_HOSTNAME = 'https://api.track.toggl.com';
const TOGGL_BASIC_AUTH   = 'xxxxxxxxxxxxxxxx:api_token';
const GOOGLE_CALENDAR_ID = 'xxxxxxxxxxxxxxxx@group.calendar.google.com';
const DatetimeFolderId = 'xxxxxxxxxxxxxxxxxxxxxx'
const ModifyDatetimeFileName = 'toggl_exporter_cache'


function getLastModifyDatetime() {
  var cache = {};
  var file = DriveApp.getFolderById(DatetimeFolderId).getFilesByName(ModifyDatetimeFileName);

  if(!file.hasNext()) {
    var now = Moment.moment();
    var two_days_ago = now.subtract(2, 'days').startOf('day');
    var beginning_day = parseInt(two_days_ago.format('X'), 10);
    putLastModifyDatetime(beginning_day);
    return beginning_day;
  }
  file = file.next();
  var data = JSON.parse(file.getAs("application/octet-stream").getDataAsString());
  return parseInt(data[CACHE_KEY], 10).toFixed();
}

function putLastModifyDatetime(unix_timestamp) {
  var cache = {};
  cache[CACHE_KEY] = unix_timestamp;
  var file = DriveApp.getFolderById(DatetimeFolderId).getFilesByName(ModifyDatetimeFileName);
  if(!file.hasNext()) {
    DriveApp.getFolderById(DatetimeFolderId).createFile(ModifyDatetimeFileName, JSON.stringify(cache));
    return true;
  }
  file = file.next();
  file.setContent(JSON.stringify(cache));
  return true;
}

function getTimeEntries(unix_timestamp) {
  var uri = TOGGL_API_HOSTNAME + '/api/v9/me/time_entries' + '?' + 'start_date=' + encodeURIComponent(Moment.moment(unix_timestamp, 'X').format()) + '&end_date=' + encodeURIComponent(Moment.moment(currentDatetime(), 'X').format());
  var response = UrlFetchApp.fetch(
    uri,
    {
      'method' : 'GET',
      'headers' : { "Authorization" : " Basic " + Utilities.base64Encode(TOGGL_BASIC_AUTH) },
      'muteHttpExceptions': true
    }
  );
  try {
    return JSON.parse(response);
  }
  catch (e) {
    Logger.log([unix_timestamp, e]);
  }
}

function getProjectData(workspace_id, project_id) {
  if(!!project_id == false) return {};
  var uri = TOGGL_API_HOSTNAME + '/api/v9/workspaces/' + workspace_id + '/projects/'+ project_id;
  var response = UrlFetchApp.fetch(
    uri,
    {
      'method' : 'GET',
      'headers' : { "Authorization" : " Basic " + Utilities.base64Encode(TOGGL_BASIC_AUTH) },
    }
  );
  try {
    return JSON.parse(response);
  }
  catch (e) {
    Logger.log(["getProjectData", e]);
  }
}

// togglイベントをGoogle calenderに記録（イベントが存在する場合は更新）
function recordActivityLog(event_id, title, started_at, ended_at, tags) {
  var calendar = CalendarApp.getCalendarById(GOOGLE_CALENDAR_ID);
  calendar.setTimeZone('Asia/Tokyo');
  var options = {
    'description': 'event_id: ' + event_id +  "\ntags: " + tags
  }

  var calendar_events = calendar.getEvents(new Date(started_at), new Date(ended_at));
  var calendar_event_found = false;
  for (var i = 0; i < calendar_events.length; i++) {
    var calendar_event = calendar_events[i];
    var calendar_description = calendar_event.getDescription();

    // 説明にユニークIDが含まれているかチェック
    if (calendar_description && calendar_description.indexOf(event_id) !== -1) {
      // イベントを更新
      calendar_event.setTitle(title);
      calendar_event.setDescription(options.description);
      Logger.log('Event updated.');
      calendar_event_found = true;
      break;  // 更新対象のイベントが見つかったらループを抜ける
    }
  }

  if (calendar_event_found == false) {
    calendar.createEvent(title, new Date(started_at), new Date(ended_at), options);
  }

}

function currentDatetime()
{
  var now = Moment.moment();
  return now.unix();
}

function watch() {
  try {
    var check_datetime = getLastModifyDatetime();
    var time_entries = getTimeEntries(check_datetime);

    if(time_entries) {
      last_stop_datetime = null;
      for (var i=0; i<time_entries.length; i++) {
        var record = time_entries[i];
        if(record.stop == null) continue;

        var project_data = getProjectData(record.workspace_id, record.project_id);
        var project_name = project_data.name || '';
        var activity_title = [(record.description || '名称なし'), project_name].filter(function(e){return e}).join(" : ");
        var tags = record.tags || ['なし'];

        recordActivityLog(
          record.id,
          activity_title,
          Moment.moment(record.start).format(),
          Moment.moment(record.stop).format(),
          tags.join()
        );
        last_stop_datetime = record.stop;
      }
      if(last_stop_datetime) {
        putLastModifyDatetime((parseInt(Moment.moment(last_stop_datetime).format('X'), 10) + 1).toFixed());
      }
    }
  }
  catch (e) {
    Logger.log(['[error]', e]);
  }
}

