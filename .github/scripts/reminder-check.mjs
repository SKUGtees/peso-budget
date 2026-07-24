import fs from 'fs';
import webpush from 'web-push';

const STATE_TOPIC = 'peso-budget-state-702cef40ec5d2051';
const SETTINGS_FILE = '.github/reminder-settings.json';
const SENT_FILE = '.github/reminder-sent.json';

const VAPID_PUBLIC_KEY = 'BGYA4vPwkdBF12PthEeJYXCpOAt5n3IseuhPmcK-eyd21B2EJ9zu5DIOMsUJ5MiZor4mt-6OyLXXFM3DC_NeIMI';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

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
  if (!VAPID_PRIVATE_KEY) {
    console.log('VAPID_PRIVATE_KEY secret not configured. Skipping.');
    return;
  }
  webpush.setVapidDetails('mailto:noreply@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  let settings = readJSON(SETTINGS_FILE, null);
  const fresh = await pollLatest(STATE_TOPIC);

  if (fresh && typeof fresh.reminderUTCHour === 'number' && typeof fresh.reminderUTCMinute === 'number' && fresh.subscription) {
    settings = {
      enabled: fresh.enabled !== false,
      reminderUTCHour: fresh.reminderUTCHour,
      reminderUTCMinute: fresh.reminderUTCMinute,
      tzOffsetMinutes: fresh.tzOffsetMinutes || 0,
      subscription: fresh.subscription
    };
    writeJSON(SETTINGS_FILE, settings);
  }

  if (!settings || settings.enabled === false || !settings.subscription) {
    console.log('Reminders not configured or disabled. Skipping.');
    return;
  }

  const now = new Date();
  const localNow = new Date(now.getTime() - (settings.tzOffsetMinutes || 0) * 60000);
  const todayLocal = localNow.toISOString().slice(0, 10);

  const loggedToday = !!(fresh && fresh.todayLocalDate === todayLocal && fresh.loggedToday === true);
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

  try {
    const payload = JSON.stringify({
      title: 'Peso Budget',
      body: "Don't forget to log today's spending!"
    });
    const res = await webpush.sendNotification(settings.subscription, payload);
    console.log('Web push sent, status:', res.statusCode);
  } catch (e) {
    console.log('Web push failed:', e.statusCode, e.body || e.message);
    if (e.statusCode === 404 || e.statusCode === 410) {
      console.log('Subscription expired/invalid, clearing it.');
      settings.subscription = null;
      writeJSON(SETTINGS_FILE, settings);
    }
    return;
  }

  writeJSON(SENT_FILE, { lastSentDate: todayLocal });
  console.log('Reminder recorded for', todayLocal);
}

main().catch(e => { console.error(e); process.exit(1); });
