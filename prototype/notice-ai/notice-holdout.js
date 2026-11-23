// 검증 세트: 측정용 30건(sample.json)과 겹치지 않는 공지 30건을 무작위로 뽑아 data/holdout.json 생성
// v2 프롬프트 규칙을 sample.json의 오답을 보고 만들었으므로, 처음 보는 공지로 다시 재기 위함
// 실행: node notice-holdout.js   (API 호출 없음, 저장된 notices.json 사용)
// 사람이 고르지 않도록 묶음별로 고정 시드 무작위 추출.
// 키워드만으로 뽑으면 대부분 낮 시간 공지(막차와 무관)라, 알림 시각이 밤(21~01시)인지로도 묶는다.
// 숫자만 다른 판박이 공지(시위 사전안내 등)와 다시 올린 공지는 하나로 친다
import { readFile, writeFile } from 'node:fs/promises';

const DIR = new URL('./data/', import.meta.url);
const notices = JSON.parse(await readFile(new URL('notices.json', DIR), 'utf8')).items;
const sample = JSON.parse(await readFile(new URL('sample.json', DIR), 'utf8'));

// 같은 공지 판정: 본문에서 숫자·기호·공백을 지운 글자의 2글자 묶음이 80% 넘게 겹치면 같다고 본다
// (같은 공지를 조사 하나, 시각 도장만 바꿔 다시 올린 경우가 많음)
const SIMILAR = 0.8;
const grams = (n) => {
  const t = `${n.noftTtl}${n.noftCn}`.replace(/[^가-힣a-zA-Z]/g, '');
  const g = new Set();
  for (let i = 0; i < t.length - 1; i++) g.add(t.slice(i, i + 2));
  return g;
};
const jaccard = (a, b) => {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
};

const hour = (n) => Number(n.noftOcrnDt.slice(11, 13));
const night = (n) => hour(n) >= 21 || hour(n) <= 1;
const has = (re) => (n) => re.test(`${n.noftTtl} ${n.noftCn}`);

// 묶음 순서대로 먼저 걸리는 묶음에 넣는다. 숫자는 뽑을 건수 (합 30)
const STRATA = [
  ['막차·연장·임시열차', has(/막차|마지막\s*열차|운행\s*종료|영업\s*종료|연장\s*운행|임시\s*열차|운휴/), 8],
  ['시간표·운행 조정', has(/시간표|운행계획|운행\s*조정|증편|증회|감축/), 4],
  ['밤 무정차', (n) => night(n) && has(/무정차/)(n), 7],
  ['밤 지연·중단', (n) => night(n) && has(/지연|중단|중지/)(n), 6],
  ['낮 무정차·지연·중단', has(/무정차|지연|중단|중지/), 5],
];

// 고정 시드 난수(mulberry32)
let seed = 20261118;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const pools = Object.fromEntries(STRATA.map(([name]) => [name, []]));
const seen = sample.map(grams); // 측정용 30건과 이미 후보에 넣은 공지
for (const n of notices) {
  const g = grams(n);
  if (seen.some((x) => jaccard(g, x) > SIMILAR)) continue;
  seen.push(g);
  const s = STRATA.find(([, match]) => match(n));
  if (s) pools[s[0]].push(n);
}

const picked = [];
for (const [name, , count] of STRATA) {
  const got = shuffle([...pools[name]]).slice(0, count);
  console.log(`${name}: 후보 ${pools[name].length}건 중 ${got.length}건`);
  picked.push(...got.map((n) => ({ stratum: name, ...n })));
}

const holdout = picked.map((n, i) => ({ id: `h${String(i + 1).padStart(2, '0')}`, ...n }));
await writeFile(new URL('holdout.json', DIR), JSON.stringify(holdout, null, 2) + '\n');
console.log(`holdout.json ${holdout.length}건 저장`);
