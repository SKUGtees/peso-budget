import fs from 'fs';

const STATE_TOPIC = 'peso-budget-state-702cef40ec5d2051';
const REMIND_TOPIC = 'peso-budget-remind-702cef40ec5d2051';
const SETTINGS_FILE = '.github/reminder-settings.json';
const SENT_FILE = '.github/reminder-sent.json';

function readJSON(path, fallback) {
  try { return JSON.parse(fs.readFileSync(path, 'utf8')); } catch { return fallback; }
}
function writeJSON(path, obj) {
  fs.writeFileSync(path, JSON.stringify(obj, null, 2) + '\n');
}

async function pollLatest(topic) {
  try {
    const res = await fetch(`https://ntfy.sh/${topic}/json?poll=1&since=12h`);
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return null;
    const last = JSON.parse(lines[lines.length - 1]);
    if (!last.message) return null;
    return JSON.parse(last.message);
  } catch (e) {
    console.log('Poll failed:', e.message);
    return null;
  }
}

async function main() {
  let settings = readJSON(SETTINGS_FILE, null);
  const fresh = await pollLatest(STATE_TOPIC);

  let loggedToday = false;

  if (fresh && typeof fresh.reminderUTCHour === 'number' && typeof fresh.reminderUTCMinute === 'number') {
    settings = {
      enabled: fresh.enabled !== false,
      reminderUTCHour: fresh.reminderUTCHour,
      reminderUTCMinute: fresh.reminderUTCMinute,
      tzOffsetMinutes: fresh.tzOffsetMinutes || 0
    };
    writeJSON(SETTINGS_FILE, settings);
  }

  if (!settings || settings.enabled === false) {
    console.log('Reminders not configured or disabled. Skipping.');
    return;
  }

  const now = new Date();
  const localNow = new Date(now.getTime() - (settings.tzOffsetMinutes || 0) * 60000);
  const todayLocal = localNow.toISOString().slice(0, 10);

  if (fresh && fresh.todayLocalDate === todayLocal && fresh.loggedToday === true) {
    loggedToday = true;
  }

  if (loggedToday) {
    console.log('Already logged today. Skipping.');
    return;
  }

  const sent = readJSON(SENT_FILE, { lastSentDate: null });
  if (sent.lastSentDate === todayLocal) {
    console.log('Reminder already sent today. Skipping.');
    return;
  }

  const nowUTCMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const targetUTCMinutes = settings.reminderUTCHour * 60 + settings.reminderUTCMinute;

  if (nowUTCMinutes < targetUTCMinutes) {
    console.log('Not yet reminder time.');
    return;
  }

  const res = await fetch(`https://ntfy.sh/${REMIND_TOPIC}`, {
    method: 'POST',
    headers: { 'Title': 'Peso Budget', 'Tags': 'moneybag' },
    body: "Don't forget to log today's spending!"
  });
  console.log('Push send status:', res.status);

  writeJSON(SENT_FILE, { lastSentDate: todayLocal });
  console.log('Reminder sent and recorded for', todayLocal);
}

main().catch(e => { console.error(e); process.exit(1); });
