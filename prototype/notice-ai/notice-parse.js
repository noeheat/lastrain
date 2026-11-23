// 운행 공지 해석 스파이크: sample.json의 공지를 한 건씩 Gemini에 보내 막차 변경을 JSON으로 뽑는다
// 실행: node --env-file=.env notice-parse.js [--prompt v1|v2] [--set sample|holdout] [--only n01,n02]
// 결과: results/predictions[-holdout][-v2].json (호출마다 응답 시간 ms, 입출력 토큰 수). sample·v1은 predictions.json
// 문서(ai.google.dev → aistudio.google.com/docs, 2026-11 확인):
//   POST v1beta/models/{model}:generateContent, 헤더 x-goog-api-key
//   JSON 스키마 강제: generationConfig.responseFormat.text = { mimeType: 'APPLICATION_JSON', schema }
//   토큰: usageMetadata.promptTokenCount / candidatesTokenCount / thoughtsTokenCount
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { toInput } from './notice-input.js';

const KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-3.1-flash-lite';
const THINKING = 'MINIMAL'; // 속도·비용 우선. 정확도가 낮으면 LOW와 비교
const GAP_MS = 4000; // 무료 등급 분당 호출 제한 대비 호출 간격
const MAX_RETRY = 3;
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// v1: 제안서와 같은 문장
const V1 = `너는 서울 지하철 운행 공지를 읽고, 막차에 영향을 주는 변경 사항만 뽑는 도우미다.
- 공지에 적힌 내용만 쓴다. 적혀 있지 않은 값은 null로 둔다.
- kind는 extend(연장운행), early_end(조기 종료), skip(무정차), delay(지연), timetable(시간표 변경), none(막차와 무관) 중 하나다.
- 날짜는 YYYY-MM-DD, 시각은 24시간제 HH:MM으로 쓴다.
- 확신이 없으면 confidence를 low로 둔다.`;

// v2: v1 채점에서 틀린 원인(연도 지어내기, 구분 코드를 호선으로 읽기, 영향 기준, false일 때 모양, 시각의 뜻)을 규칙과 예시로 보탠 것.
// 예시 공지 3건은 지어낸 것이다(측정용 30건과 겹치지 않게).
const V2 = `${V1}

[막차에 영향이 있는지]
- 막차 시각이 바뀌거나(연장·조기 종료·시간표 변경), 22시 이후에 일어나거나 운행 종료 때까지 이어지는 무정차·운행 중단·지연이면 affects_last_train은 true다.
- 출퇴근 시간대 연장·증편, 22시 전에 끝나는 상황, 이미 끝난 상황(정상 운행 재개, 무정차 종료), 연장 취소·미시행 안내는 false다.
- affects_last_train이 false면 changes에는 kind가 none이고 나머지가 모두 null인 항목 하나만 넣는다.

[값 쓰는 법]
- date: 연도까지 알 수 있을 때만 쓴다. 본문 끝의 "MM-DD hh:mm:ss"는 알림을 보낸 시각이고 연도가 없으므로 날짜로 쓰지 않는다. 기간에 연도가 있으면 그 날짜를 쓴다.
- line: "N호선" 또는 노선 이름(예: 수인선)으로 쓰고, 여러 호선이면 "1~8호선"처럼 쓴다. 공지에 호선이 없으면 null. "구분"은 알림 종류 코드이지 호선 번호가 아니다.
- from_station·to_station: 역 이름에서 "역"을 뺀다.
- new_last_departure: 바뀐 뒤 마지막 열차 시각. "종착역 기준 02시까지 연장"이면 "02:00", "24:46"이면 "00:46". 운행 중단이 시작되는 시각("오늘밤 12시부터 중단")은 막차 시각이 아니므로 null.
- delay_minutes: 지연 분이 적혀 있을 때만 쓴다.

[예시]
입력:
제목: 3호선 막차 연장 안내
내용: 행사 관련 3호선 마지막 열차를 종착역 기준 01:30까지 연장 운행합니다. 11-02 18:00:00
구분: 6
기간: 없음 ~ 없음
출력: {"affects_last_train":true,"changes":[{"line":"3호선","from_station":null,"to_station":null,"kind":"extend","date":null,"new_last_departure":"01:30","delay_minutes":null}],"confidence":"high","summary":"3호선 마지막 열차를 종착역 기준 01:30까지 연장"}

입력:
제목: 7호선 논현역 무정차 통과 종료
내용: 7호선 논현역 무정차 통과는 21:40부로 종료되어 정상 운행 중입니다. 05-14 21:42:10
구분: 5
기간: 없음 ~ 2026-05-14T21:40:00
출력: {"affects_last_train":false,"changes":[{"line":null,"from_station":null,"to_station":null,"kind":"none","date":null,"new_last_departure":null,"delay_minutes":null}],"confidence":"high","summary":"7호선 논현역 무정차가 끝나 정상 운행"}

입력:
제목: 8호선 열차 지연
내용: 23:05경 8호선 문정역 신호 장애로 모란 방면 열차가 약 10분 지연 운행 중입니다. 03-09 23:12:40
구분: 4
기간: 없음 ~ 없음
출력: {"affects_last_train":true,"changes":[{"line":"8호선","from_station":"문정","to_station":"모란","kind":"delay","date":null,"new_last_departure":null,"delay_minutes":10}],"confidence":"high","summary":"8호선 문정역 신호 장애로 모란 방면 약 10분 지연"}`;

const PROMPTS = { v1: V1, v2: V2 };
const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null);
const VERSION = arg('--prompt') ?? 'v1';
const SYSTEM_PROMPT = PROMPTS[VERSION];
if (!SYSTEM_PROMPT) throw new Error(`--prompt는 ${Object.keys(PROMPTS).join('/')} 중 하나`);
const SET = arg('--set') ?? 'sample'; // sample: 측정용 30건, holdout: 검증 세트 30건
if (!['sample', 'holdout'].includes(SET)) throw new Error('--set은 sample/holdout 중 하나');
const OUT_FILE = `predictions${SET === 'holdout' ? '-holdout' : ''}${VERSION === 'v1' ? '' : `-${VERSION}`}.json`;

const str = { type: ['string', 'null'] };
const SCHEMA = {
  type: 'object',
  properties: {
    affects_last_train: { type: 'boolean' },
    changes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          line: str,
          from_station: str,
          to_station: str,
          kind: { type: 'string', enum: ['extend', 'early_end', 'skip', 'delay', 'timetable', 'none'] },
          date: str,
          new_last_departure: str,
          delay_minutes: { type: ['number', 'null'] },
        },
        required: ['line', 'from_station', 'to_station', 'kind', 'date', 'new_last_departure', 'delay_minutes'],
      },
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    summary: { type: 'string' },
  },
  required: ['affects_last_train', 'changes', 'confidence', 'summary'],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 429·503이면 응답의 retryDelay(없으면 30초)만큼 기다렸다 다시 시도
function retryWait(body) {
  const info = body?.error?.details?.find((d) => String(d['@type']).endsWith('RetryInfo'));
  const sec = parseFloat(info?.retryDelay ?? '');
  return (Number.isFinite(sec) ? sec + 1 : 30) * 1000;
}

async function call(notice) {
  const req = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: toInput(notice) }] }],
    generationConfig: {
      responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: SCHEMA } },
      thinkingConfig: { thinkingLevel: THINKING },
    },
  };
  const retries = [];
  for (let attempt = 1; ; attempt++) {
    const t0 = performance.now();
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(60000),
    });
    const body = await res.json().catch(() => null);
    const ms = Math.round(performance.now() - t0);
    if ((res.status === 429 || res.status === 503) && attempt <= MAX_RETRY) {
      const wait = retryWait(body);
      retries.push({ status: res.status, waitMs: wait });
      console.log(`  ${notice.id} HTTP ${res.status}, ${Math.round(wait / 1000)}초 기다렸다 다시 시도 (${attempt}/${MAX_RETRY})`);
      await sleep(wait);
      continue;
    }
    const u = body?.usageMetadata ?? {};
    const usage = {
      input: u.promptTokenCount ?? null,
      output: u.candidatesTokenCount ?? null,
      thoughts: u.thoughtsTokenCount ?? 0,
      total: u.totalTokenCount ?? null,
    };
    if (!res.ok) return { id: notice.id, ok: false, status: res.status, ms, retries, error: body?.error ?? body };
    const text = body.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? '').join('');
    let output = null;
    try {
      output = JSON.parse(text);
    } catch {
      return { id: notice.id, ok: false, status: res.status, ms, retries, usage, error: 'JSON 파싱 실패', text };
    }
    return { id: notice.id, ok: true, ms, retries, usage, finishReason: body.candidates?.[0]?.finishReason, output };
  }
}

if (!KEY) throw new Error('환경변수 GEMINI_API_KEY가 없습니다 (.env.example 참고)');
const sample = JSON.parse(await readFile(new URL(`./data/${SET}.json`, import.meta.url), 'utf8'));
const only = arg('--only')?.split(',') ?? null;
const targets = only ? sample.filter((n) => only.includes(n.id)) : sample;

const results = [];
for (const [i, n] of targets.entries()) {
  if (i > 0) await sleep(GAP_MS);
  const r = await call(n);
  results.push(r);
  const o = r.output;
  console.log(
    `${n.id} ${r.ok ? 'ok' : `실패 ${r.status}`} ${r.ms}ms 입력${r.usage?.input} 출력${r.usage?.output}+생각${r.usage?.thoughts}`,
    o ? `→ ${o.affects_last_train} ${o.changes?.[0]?.kind} ${o.changes?.[0]?.new_last_departure}` : JSON.stringify(r.error).slice(0, 200),
  );
}

const dir = new URL('./results/', import.meta.url);
await mkdir(dir, { recursive: true });
await writeFile(
  new URL(OUT_FILE, dir),
  JSON.stringify({ model: MODEL, promptVersion: VERSION, set: SET, thinkingLevel: THINKING, gapMs: GAP_MS, ranAt: new Date().toISOString(), systemPrompt: SYSTEM_PROMPT, schema: SCHEMA, results }, null, 2) + '\n',
);
console.log(`저장: ${results.filter((r) => r.ok).length}/${results.length}건 성공`);
