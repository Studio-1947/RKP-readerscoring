const listenBtn = document.querySelector('#listenBtn');
const recordBtn = document.querySelector('#recordBtn');
const recordLabel = document.querySelector('#recordLabel');
const recordStatus = document.querySelector('#recordStatus');
const recordHint = document.querySelector('#recordHint');
const timer = document.querySelector('#timer');
const scoreDialog = document.querySelector('#scoreDialog');
const scoreResult = document.querySelector('#scoreResult');
const storyText = [...document.querySelectorAll('.passage p')].map((p) => p.textContent).join(' ');

let timerId;
let seconds = 0;
let mediaRecorder;
let recording = false;

function formatTime(value) {
  const minutes = String(Math.floor(value / 60)).padStart(2, '0');
  const secs = String(value % 60).padStart(2, '0');
  return `${minutes}:${secs}`;
}

listenBtn.addEventListener('click', () => {
  if (!('speechSynthesis' in window)) return;
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    listenBtn.classList.remove('speaking');
    listenBtn.querySelector('span:last-child').textContent = 'पहले सुनें';
    return;
  }
  const voice = new SpeechSynthesisUtterance(storyText);
  voice.lang = 'hi-IN';
  voice.rate = 0.85;
  voice.onend = () => {
    listenBtn.classList.remove('speaking');
    listenBtn.querySelector('span:last-child').textContent = 'पहले सुनें';
  };
  listenBtn.classList.add('speaking');
  listenBtn.querySelector('span:last-child').textContent = 'सुन रहे हैं…';
  speechSynthesis.speak(voice);
});

async function startRecording() {
  try {
    scoreResult.hidden = true;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    recording = true;
    seconds = 0;
    recordBtn.classList.add('recording');
    recordLabel.textContent = 'रिकॉर्डिंग रोकें';
    recordStatus.textContent = 'आप पढ़ रहे हैं…';
    recordHint.textContent = 'अपनी सहज गति बनाए रखें';
    timerId = setInterval(() => { seconds += 1; timer.textContent = formatTime(seconds); }, 1000);
  } catch (error) {
    recordStatus.textContent = 'माइक्रोफ़ोन की अनुमति चाहिए';
    recordHint.textContent = 'ब्राउज़र में माइक्रोफ़ोन अनुमति देकर दोबारा कोशिश करें';
  }
}

function stopRecording() {
  mediaRecorder?.stop();
  mediaRecorder?.stream.getTracks().forEach((track) => track.stop());
  clearInterval(timerId);
  recording = false;
  recordBtn.classList.remove('recording');
  recordLabel.textContent = 'फिर से पढ़ें';
  recordStatus.textContent = 'बहुत बढ़िया! अभ्यास पूरा हुआ';
  recordHint.textContent = `${formatTime(seconds)} की रिकॉर्डिंग — रोज़ पढ़ें, स्कोर बढ़ाएँ`;
  scoreResult.hidden = false;
}

recordBtn.addEventListener('click', () => recording ? stopRecording() : startRecording());
document.querySelector('#scoreInfo').addEventListener('click', () => scoreDialog.showModal());
document.querySelector('.dialog-close').addEventListener('click', () => scoreDialog.close());
scoreDialog.addEventListener('click', (event) => { if (event.target === scoreDialog) scoreDialog.close(); });

function showView() {
  const requested = location.hash.slice(1);
  const view = ['leaderboard', 'progress'].includes(requested) ? requested : 'practice';
  document.querySelectorAll('[data-view]').forEach((section) => { section.hidden = section.dataset.view !== view; });
  document.querySelectorAll('.mobile-nav a, .desktop-nav a').forEach((link) => {
    const active = link.getAttribute('href') === '#' + view;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', showView);
showView();

const sampleReaders = [
  {name:'विवान',week:94,all:97,lessons:24},
  {name:'अनया',week:87,all:95,lessons:21},
  {name:'कबीर',week:81,all:90,lessons:18},
  {name:'मीरा',week:76,all:92,lessons:20},
  {name:'रूहान',week:72,all:84,lessons:16},
  {name:'आप',week:58,all:78,lessons:12,own:true},
  {name:'सिया',week:55,all:76,lessons:10},
  {name:'अर्जुन',week:55,all:73,lessons:9}
];
let boardPeriod = 'week';
let readerProfile = null;
function renderBoard() {
  const readers = sampleReaders.map((reader) => reader.own && readerProfile ? {...reader,name:readerProfile.name,id:readerProfile.clubId} : reader);
  const sorted = readers.sort((a,b) => b[boardPeriod] - a[boardPeriod]);
  let rank = 1;
  const ranked = sorted.map((reader,i) => {
    if (i && reader[boardPeriod] !== sorted[i-1][boardPeriod]) rank = i+1;
    return {...reader,rank};
  });
  const query = document.querySelector('#readerSearch').value.trim().normalize('NFC');
  const visible = ranked.filter(reader => reader.name.normalize('NFC').includes(query) || (reader.id || '').toUpperCase().includes(query.toUpperCase()));
  const average = Math.round(ranked.reduce((sum,reader) => sum + reader[boardPeriod],0) / ranked.length);
  const excellent = ranked.filter((reader) => reader[boardPeriod] >= 90).length;
  const strong = ranked.filter((reader) => reader[boardPeriod] >= 75 && reader[boardPeriod] < 90).length;
  const growing = ranked.length - excellent - strong;
  document.querySelector('#readerCount').textContent = ranked.length;
  document.querySelector('#topScore').textContent = ranked[0][boardPeriod];
  document.querySelector('#yourRank').textContent = '#' + ranked.find(reader => reader.own).rank;
  document.querySelector('#averageScore').textContent = average;
  document.querySelector('#averageGauge').style.width = `${average}%`;
  const english = document.documentElement.lang === 'en';
  document.querySelector('#averageTrend').textContent = boardPeriod === 'week' ? (english ? '↑ 6 points this week' : '↑ 6 अंक इस हफ्ते') : (english ? 'Overall average' : 'अब तक का औसत');
  document.querySelector('#excellentCount').textContent = excellent;
  document.querySelector('#strongCount').textContent = strong;
  document.querySelector('#growingCount').textContent = growing;
  document.querySelector('#excellentBar').style.width = `${excellent / ranked.length * 100}%`;
  document.querySelector('#strongBar').style.width = `${strong / ranked.length * 100}%`;
  document.querySelector('#growingBar').style.width = `${growing / ranked.length * 100}%`;
  document.querySelector('#lessonTotal').textContent = ranked.reduce((sum,reader) => sum + reader.lessons,0);
  const activity = boardPeriod === 'week' ? [12,16,14,20,18,27,23] : [18,23,26,31,35,41,46];
  document.querySelector('#activitySpark').innerHTML = activity.map((value) => `<i style="height:${value / Math.max(...activity) * 100}%"></i>`).join('');
  document.querySelector('#topReaders').innerHTML = ranked.slice(0,3).map(reader =>
    '<article class="top-reader"><span class="medal">#'+reader.rank+'</span><span class="profile-avatar">'+reader.name[0]+'</span><div><h2>'+reader.name+'</h2><p>'+reader[boardPeriod]+' /100 · '+reader.lessons+' पाठ</p></div></article>'
  ).join('');
  document.querySelector('#readerRows').innerHTML = visible.map(reader =>
    '<tr class="'+(reader.own?'own-row':'')+'"><td class="rank-position">#'+reader.rank+'</td><th scope="row"><div class="reader-name"><span class="mini-avatar">'+reader.name[0]+'</span><div>'+reader.name+(reader.id?'<small>'+reader.id+'</small>':reader.own?'<small>नमूना प्रोफ़ाइल</small>':'')+'</div></div></th><td>'+reader.lessons+'</td><td><b>'+reader[boardPeriod]+'</b><small>/100</small></td></tr>'
  ).join('');
  document.querySelector('#resultCount').textContent = visible.length + ' पाठक';
  document.querySelector('#noReaders').hidden = visible.length > 0;
}
document.querySelectorAll('[data-period]').forEach(button => button.addEventListener('click', () => {
  boardPeriod = button.dataset.period;
  document.querySelectorAll('[data-period]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  renderBoard();
}));
document.querySelector('#readerSearch').addEventListener('input',renderBoard);
renderBoard();
document.querySelector('#scoreChart').innerHTML = [58,63,61,68,72,75,78].map(score =>
  '<div class="chart-bar" style="height:'+score+'%"><span>'+score+'</span></div>'
).join('');

window.readerClub = {
  startPractice: () => recordBtn.click(),
  listenToPassage: () => listenBtn.click(),
  openScoreGuide: () => scoreDialog.showModal()
};

if (document.modelContext?.registerTool) {
  const register = (tool) => Promise.resolve(document.modelContext.registerTool(tool)).catch(() => {});
  register({
    name: 'start_reading_practice',
    title: 'रीडिंग अभ्यास शुरू करें',
    description: 'मौजूदा हिंदी पाठ के लिए रिकॉर्डिंग अभ्यास शुरू करता है।',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    async execute() {
      if (recording) return { status: 'already_recording', elapsedSeconds: seconds };
      await startRecording();
      return { status: recording ? 'recording' : 'microphone_unavailable', lesson: 'आँगन की धूप' };
    }
  });
  register({
    name: 'listen_to_current_passage',
    title: 'मौजूदा पाठ सुनें',
    description: 'मौजूदा हिंदी पाठ को ब्राउज़र की आवाज़ में पढ़ता है।',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute() {
      listenBtn.click();
      return { status: 'playing', lesson: 'आँगन की धूप', wordCount: 60 };
    }
  });
}

const authDialog = document.querySelector('#authDialog');
const profileStep = document.querySelector('#profileStep');
const otpStep = document.querySelector('#otpStep');
const accountStep = document.querySelector('#accountStep');
const loginBtn = document.querySelector('#loginBtn');
const loginLabel = document.querySelector('#loginLabel');
const toast = document.querySelector('#toast');
let pendingProfile = null;
let pendingAction = null;
let toastTimer;

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
}

function showAuthStep(step) {
  profileStep.hidden = step !== 'profile';
  otpStep.hidden = step !== 'otp';
  accountStep.hidden = step !== 'account';
}

function maskPhone(phone) {
  return `••••••${phone.slice(-4)}`;
}

function createClubId() {
  return `RKP-${String(Math.floor(100000 + Math.random() * 900000))}`;
}

function updateAccountUI() {
  if (!readerProfile) return;
  document.querySelector('#accountInitial').textContent = readerProfile.name.trim().charAt(0) || 'प';
  document.querySelector('#accountName').textContent = readerProfile.name;
  document.querySelector('#accountClubId').textContent = readerProfile.clubId;
  document.querySelector('#accountPhone').textContent = maskPhone(readerProfile.phone);
  document.querySelector('#accountPin').textContent = readerProfile.pin;
  document.querySelector('#accountAuthors').textContent = readerProfile.authors || '—';
  document.querySelector('#accountBooks').textContent = readerProfile.books || '—';
  loginLabel.textContent = readerProfile.name.split(/\s+/)[0];
  renderBoard();
}

function openAccount(action) {
  pendingAction = action || null;
  showAuthStep(readerProfile ? 'account' : 'profile');
  if (readerProfile) updateAccountUI();
  authDialog.showModal();
}

function requireLogin(action) {
  if (readerProfile) return action();
  openAccount(action);
}

loginBtn.addEventListener('click', () => openAccount());
document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => document.querySelector(`#${button.dataset.close}`).close()));

document.querySelector('#profileForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  pendingProfile = {
    name: String(data.get('name')).trim(),
    phone: String(data.get('phone')).trim(),
    channel: String(data.get('channel')),
    pin: String(data.get('pin')).trim(),
    authors: String(data.get('authors')).trim(),
    books: String(data.get('books')).trim()
  };
  document.querySelector('#maskedPhone').textContent = maskPhone(pendingProfile.phone);
  showAuthStep('otp');
  document.querySelector('#otpInput').focus();
});

document.querySelector('#backToProfile').addEventListener('click', () => showAuthStep('profile'));
document.querySelector('#otpForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const valid = document.querySelector('#otpInput').value === '123456';
  document.querySelector('#otpError').hidden = valid;
  if (!valid) return;
  readerProfile = {...pendingProfile, clubId: createClubId()};
  updateAccountUI();
  showAuthStep('account');
  showToast('मोबाइल वेरिफ़ाई हुआ — Reading Club ID तैयार है।');
  if (pendingAction) {
    const action = pendingAction;
    pendingAction = null;
    authDialog.close();
    setTimeout(action, 0);
  }
});

document.querySelector('#demoLogout').addEventListener('click', () => {
  readerProfile = null;
  pendingProfile = null;
  loginLabel.textContent = document.documentElement.lang === 'en' ? 'Log in' : 'लॉग इन';
  document.querySelector('#profileForm').reset();
  document.querySelector('#otpForm').reset();
  authDialog.close();
  showToast('डेमो अकाउंट से लॉग आउट हो गया।');
});

async function copyText(value) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const field = document.createElement('textarea');
  field.value = value; field.style.position = 'fixed'; field.style.opacity = '0';
  document.body.appendChild(field); field.select(); document.execCommand('copy'); field.remove();
}

document.querySelector('#copyClubId').addEventListener('click', async () => {
  await copyText(readerProfile.clubId);
  showToast('Reading Club ID कॉपी हो गया।');
});

function downloadBlob(filename, blob) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function downloadCsv(filename, rows) {
  const csv = '\uFEFF' + rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"','""')}"`).join(',')).join('\n');
  downloadBlob(filename, new Blob([csv], {type:'text/csv;charset=utf-8'}));
}

function downloadLeaderboard() {
  const rows = [['स्थान','पाठक','पूरे पाठ','सर्वश्रेष्ठ स्कोर']];
  sampleReaders.map((reader) => reader.own ? {...reader,name:readerProfile.name} : reader).sort((a,b) => b[boardPeriod] - a[boardPeriod]).forEach((reader,index) => rows.push([index + 1,reader.name,reader.lessons,reader[boardPeriod]]));
  downloadCsv('hindi-leaderboard.csv',rows);
  showToast('लीडरबोर्ड डाउनलोड हो गया।');
}

function downloadScoreboard() {
  downloadCsv('mera-hindi-scoreboard.csv',[
    ['नाम','Reading Club ID','स्कोर','उच्चारण','सहजता','गति','स्ट्रीक'],
    [readerProfile.name,readerProfile.clubId,78,82,74,70,'5 दिन']
  ]);
  showToast('आपका स्कोरबोर्ड डाउनलोड हो गया।');
}

function createScoreCardBlob() {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200; canvas.height = 630;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#9f1420'; ctx.fillRect(0,0,1200,630);
    ctx.fillStyle = '#c91e2b'; ctx.beginPath(); ctx.arc(1080,80,250,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffd84d'; ctx.fillRect(70,70,86,12);
    ctx.fillStyle = '#ffffff'; ctx.font = '700 34px sans-serif'; ctx.fillText('हिंदी रीडिंग स्कोर',70,135);
    ctx.font = '800 58px sans-serif'; ctx.fillText(readerProfile.name,70,235);
    ctx.fillStyle = '#ffd9dd'; ctx.font = '700 26px sans-serif'; ctx.fillText(readerProfile.clubId,70,280);
    ctx.fillStyle = '#ffffff'; ctx.font = '900 170px sans-serif'; ctx.fillText('78',70,485);
    ctx.font = '700 32px sans-serif'; ctx.fillText('/100',270,475);
    ctx.fillStyle = '#ffd84d'; ctx.font = '800 30px sans-serif'; ctx.fillText('🔥 5 दिन की स्ट्रीक',760,520);
    ctx.fillStyle = '#ffffff'; ctx.font = '800 30px sans-serif'; ctx.fillText('पढ़ाकू · राजकमल रीडिंग क्लब',70,575);
    canvas.toBlob(resolve,'image/png');
  });
}

function encodeReaderCard(data) {
  const utf8 = encodeURIComponent(JSON.stringify(data)).replace(/%([0-9A-F]{2})/g,(_,hex) => String.fromCharCode(parseInt(hex,16)));
  return btoa(utf8).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}

function decodeReaderCard(value) {
  const normalized = value.replaceAll('-','+').replaceAll('_','/');
  const base64 = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const bytes = atob(base64);
  return JSON.parse(decodeURIComponent([...bytes].map(char => `%${char.charCodeAt(0).toString(16).padStart(2,'0')}`).join('')));
}

function readerShareUrl() {
  const url = new URL(location.origin + location.pathname);
  url.searchParams.set('reader',encodeReaderCard({name:readerProfile.name,id:readerProfile.clubId,score:78,streak:5}));
  url.hash = 'practice';
  return url.toString();
}

async function shareScoreCard() {
  const url = readerShareUrl();
  const shareData = {title:`${readerProfile.name} का हिंदी रीडिंग स्कोर`,text:`मेरा हिंदी रीडिंग स्कोर 78/100 है। Reading Club ID: ${readerProfile.clubId}`,url};
  if (navigator.share) {
    try { await navigator.share(shareData); return; } catch (error) { if (error.name === 'AbortError') return; }
  }
  await copyText(url);
  showToast('शेयर लिंक कॉपी हो गया।');
}

document.querySelector('#shareScoreBtn').addEventListener('click', () => requireLogin(shareScoreCard));
document.querySelector('#downloadScoreBtn').addEventListener('click', () => requireLogin(async () => {
  const blob = await createScoreCardBlob();
  downloadBlob('hindi-reading-score-card.png',blob);
  showToast('हिंदी स्कोर कार्ड डाउनलोड हो गया।');
}));
document.querySelectorAll('[data-download]').forEach((button) => button.addEventListener('click', () => requireLogin(button.dataset.download === 'leaderboard' ? downloadLeaderboard : downloadScoreboard)));

const sharedReader = new URLSearchParams(location.search).get('reader');
if (sharedReader) {
  try {
    const data = decodeReaderCard(sharedReader);
    document.querySelector('#publicInitial').textContent = String(data.name || 'प').charAt(0);
    document.querySelector('#publicName').textContent = data.name || 'पाठक';
    document.querySelector('#publicClubId').textContent = data.id || '';
    document.querySelector('#publicScore').textContent = Number(data.score) || 0;
    document.querySelector('#publicStreak').textContent = `🔥 ${Number(data.streak) || 0} दिन की स्ट्रीक`;
    setTimeout(() => document.querySelector('#shareProfileDialog').showModal(),0);
  } catch (error) { /* Ignore malformed public card links. */ }
}

const languageSelect = document.querySelector('#languageSelect');
const translations = {
  hi: {brand:'हिंदी रीडिंग क्लब',practice:'आज का पाठ',leaderboard:'लीडरबोर्ड',progress:'मेरी प्रगति',login:'लॉग इन',scoreEyebrow:'हिंदी रीडिंग स्कोर',scoreTitle:'पढ़िए, रिकॉर्ड कीजिए, स्कोर बढ़ाइए।',scoreIntro:'आज का छोटा हिंदी पाठ अपनी आवाज़ में पढ़ें।',boardTitle:'लीडरबोर्ड',boardIntro:'हर पाठक का सबसे अच्छा प्रदर्शन, एक जगह।',progressTitle:'मेरी प्रगति',progressIntro:'अपनी पढ़ने की आदत और सुधार को समझें।',download:'डाउनलोड',scoreboard:'स्कोरबोर्ड डाउनलोड',listen:'पहले सुनें',ready:'तैयार हैं? अपनी आवाज़ में पढ़ें',hint:'गलती की चिंता मत कीजिए — बस शुरू करें',record:'रिकॉर्डिंग शुरू करें',scoreHelp:'स्कोर कैसे बनता है',average:'औसत स्कोर',distribution:'स्कोर का स्तर',readerMix:'पाठकों का वितरण',excellent:'उत्कृष्ट',strong:'मजबूत',growing:'अभ्यास जारी',activity:'रीडिंग गतिविधि',lessons:'पाठ पूरे',days:['सो','मं','बु','गु','शु','श','र']},
  en: {brand:'Hindi Reading Club',practice:"Today's reading",leaderboard:'Leaderboard',progress:'My progress',login:'Log in',scoreEyebrow:'Hindi reading score',scoreTitle:'Read, record, improve your score.',scoreIntro:'Read today’s short Hindi passage in your own voice.',boardTitle:'Leaderboard',boardIntro:'Every reader’s best performance, in one place.',progressTitle:'My progress',progressIntro:'Understand your reading habit and improvement.',download:'Download',scoreboard:'Download scoreboard',listen:'Listen first',ready:'Ready? Read in your own voice',hint:'Don’t worry about mistakes — just begin',record:'Start recording',scoreHelp:'How is the score calculated?',average:'Average score',distribution:'Score levels',readerMix:'Reader distribution',excellent:'Excellent',strong:'Strong',growing:'Practising',activity:'Reading activity',lessons:'lessons completed',days:['M','T','W','T','F','S','S']}
};

function setMobileLinkText(selector,text) {
  const link = document.querySelector(selector);
  if (link?.lastChild) link.lastChild.nodeValue = text;
}

function applyLanguage() {
  const lang = languageSelect.value;
  const copy = translations[lang];
  document.documentElement.lang = lang;
  languageSelect.setAttribute('aria-label',lang === 'en' ? 'Interface language' : 'इंटरफ़ेस भाषा');
  document.querySelector('#brandSubtitle').textContent = copy.brand;
  document.querySelector('.desktop-nav a[href="#practice"]').textContent = copy.practice;
  document.querySelector('.desktop-nav a[href="#leaderboard"]').textContent = copy.leaderboard;
  document.querySelector('.desktop-nav a[href="#progress"]').textContent = copy.progress;
  setMobileLinkText('.mobile-nav a[href="#practice"]',copy.practice);
  setMobileLinkText('.mobile-nav a[href="#leaderboard"]',copy.leaderboard);
  setMobileLinkText('.mobile-nav a[href="#progress"]',copy.progress);
  if (!readerProfile) loginLabel.textContent = copy.login;
  document.querySelector('.practice-intro .eyebrow').textContent = copy.scoreEyebrow;
  document.querySelector('.practice-intro h1').textContent = copy.scoreTitle;
  document.querySelector('.practice-intro div > p:last-child').textContent = copy.scoreIntro;
  document.querySelector('#board-title').textContent = copy.boardTitle;
  document.querySelector('#board-title').nextElementSibling.textContent = copy.boardIntro;
  document.querySelector('#progress-title').textContent = copy.progressTitle;
  document.querySelector('#progress-title').nextElementSibling.textContent = copy.progressIntro;
  document.querySelector('[data-download="leaderboard"]').textContent = copy.download;
  document.querySelector('[data-download="scoreboard"]').textContent = copy.scoreboard;
  if (!('speechSynthesis' in window) || !speechSynthesis.speaking) document.querySelector('#listenBtn span:last-child').textContent = copy.listen;
  if (!recording) {
    recordStatus.textContent = copy.ready;
    recordHint.textContent = copy.hint;
    recordLabel.textContent = copy.record;
  }
  document.querySelector('#scoreInfo').setAttribute('aria-label',copy.scoreHelp);
  document.querySelector('#averageLabel').textContent = copy.average;
  document.querySelector('#distributionLabel').textContent = copy.distribution;
  document.querySelector('#distributionIntro').textContent = copy.readerMix;
  document.querySelector('#excellentLabel').textContent = copy.excellent;
  document.querySelector('#strongLabel').textContent = copy.strong;
  document.querySelector('#growingLabel').textContent = copy.growing;
  document.querySelector('#activityLabel').textContent = copy.activity;
  document.querySelector('#lessonsLabel').textContent = copy.lessons;
  document.querySelectorAll('.spark-days span').forEach((day,index) => { day.textContent = copy.days[index]; });
  renderBoard();
}
const savedLanguage = localStorage.getItem('reader-language');
if (savedLanguage === 'hi' || savedLanguage === 'en') languageSelect.value = savedLanguage;
languageSelect.addEventListener('change',() => { localStorage.setItem('reader-language',languageSelect.value); applyLanguage(); });
applyLanguage();
