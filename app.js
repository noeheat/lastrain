import { computePlan, formatRemaining, formatClock, parseHHMM } from './time.js';

const KEY = 'lastTrain.v1';
const $ = (id) => document.getElementById(id);

// 디버그: ?now=23:40 → 오늘 23:40부터 시계가 흐르는 것처럼 동작
const nowOffset = (() => {
  const m = parseHHMM(new URLSearchParams(location.search).get('now'));
  if (m == null) return 0;
  const real = new Date();
  const fake = new Date(real.getFullYear(), real.getMonth(), real.getDate(), 0, m);
  return fake - real;
})();
const now = () => new Date(Date.now() + nowOffset);

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(data?.people) && data.people.length === 2) return data;
  } catch { /* 손상된 값은 무시 */ }
  return null;
}

function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* 저장 불가(사생활 모드 등) */ }
}

let state = load();
let timer = null;

// ---------- 입력 화면 ----------

function fillForm(people) {
  const form = $('form');
  people.forEach((p, i) => {
    form[`name${i}`].value = p.name;
    form[`station${i}`].value = p.station;
    form[`train${i}`].value = p.train;
    form[`walk${i}`].value = p.walk;
  });
}

function readForm() {
  const form = $('form');
  const people = [];
  let firstBad = null;
  const mark = (el, ok) => {
    el.setAttribute('aria-invalid', String(!ok));
    if (!ok && !firstBad) firstBad = el;
  };

  for (const i of [0, 1]) {
    const name = form[`name${i}`];
    const station = form[`station${i}`];
    const train = form[`train${i}`];
    const walk = form[`walk${i}`];
    const walkNum = Number(walk.value);
    mark(name, name.value.trim() !== '');
    mark(station, station.value.trim() !== '');
    mark(train, parseHHMM(train.value) != null);
    mark(walk, walk.value !== '' && Number.isInteger(walkNum) && walkNum >= 0 && walkNum <= 180);
    people.push({
      name: name.value.trim(),
      station: station.value.trim(),
      train: train.value,
      walk: walkNum,
    });
  }

  if (firstBad) {
    firstBad.focus();
    return null;
  }
  return people;
}

function showSetup() {
  stopTicking();
  document.body.classList.remove('counting');
  document.body.dataset.level = 'calm';
  if (state) fillForm(state.people);
  $('countdown').hidden = true;
  $('setup').hidden = false;
}

$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const people = readForm();
  if (!people) {
    $('error').textContent = '빈칸이나 잘못된 값이 있어요. 도보 시간은 0~180분입니다.';
    return;
  }
  $('error').textContent = '';
  state = { people };
  save(state);
  showCountdown();
});

$('edit').addEventListener('click', showSetup);

// ---------- 카운트다운 화면 ----------

function render() {
  const plan = computePlan(state.people, now());
  const { rows, lead, level } = plan;
  document.body.dataset.level = level;

  const clock = $('clock');
  if (level === 'missed') {
    $('leadLabel').textContent = '오늘 막차는 모두 지났어요';
    clock.textContent = '막차 끝';
    clock.classList.add('text');
    $('leadSub').textContent = '택시나 심야버스를 찾아보세요';
  } else {
    const r = rows[lead];
    if (level === 'go') {
      $('leadLabel').textContent = `${r.name} 출발 시각이 지났어요`;
      clock.textContent = '지금 출발!';
      clock.classList.add('text');
      $('leadSub').textContent = `${r.station} 막차 ${formatClock(r.trainAt)}까지 ${formatRemaining(r.msToTrain)}`;
    } else {
      $('leadLabel').textContent = `${r.name} 출발까지`;
      clock.textContent = formatRemaining(r.msToDepart);
      clock.classList.remove('text');
      $('leadSub').textContent = `${formatClock(r.departAt)}에 출발 · ${r.station} 막차 ${formatClock(r.trainAt)}`;
    }
  }

  const list = $('people');
  list.replaceChildren(...rows.map((r, i) => {
    const li = document.createElement('li');
    if (i === lead) li.classList.add('lead');
    if (r.missed) li.classList.add('missed');

    const info = document.createElement('div');
    const who = document.createElement('div');
    who.className = 'who';
    who.textContent = r.name;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${r.station} · 막차 ${formatClock(r.trainAt)} · 도보 ${r.walk}분 · ${formatClock(r.departAt)} 출발`;
    info.append(who, meta);

    const left = document.createElement('div');
    left.className = 'left';
    left.textContent = r.missed ? '놓침' : r.msToDepart <= 0 ? '출발!' : formatRemaining(r.msToDepart);

    li.append(info, left);
    return li;
  }));
}

function startTicking() {
  stopTicking();
  render();
  // 초 경계에 맞춰 갱신
  timer = setTimeout(function tick() {
    render();
    timer = setTimeout(tick, 1000 - (now().getMilliseconds() % 1000) + 5);
  }, 1000 - (now().getMilliseconds() % 1000) + 5);
}

function stopTicking() {
  clearTimeout(timer);
  timer = null;
}

function showCountdown() {
  $('setup').hidden = true;
  $('countdown').hidden = false;
  document.body.classList.add('counting');
  startTicking();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopTicking();
  else if (!$('countdown').hidden) startTicking();
});

// ---------- 시작 ----------

if (state) showCountdown();
else showSetup();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
