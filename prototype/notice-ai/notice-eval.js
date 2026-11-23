// 운행 공지 해석 채점: gold.json과 predictions.json을 비교해 results/notice-eval.md 생성
// 실행: node notice-eval.js   (API 호출 없음)
// 판정: changes가 여러 개면 첫 항목으로 채점. null과 null은 일치. 시각은 HH:MM 문자열이 정확히 같아야 일치.
//       line은 공백만 지우고 비교("1~8호선" ≠ "1호선").
import { readFile, writeFile } from 'node:fs/promises';
import { toInput } from './notice-input.js';

const read = async (p) => JSON.parse(await readFile(new URL(p, import.meta.url), 'utf8'));
const gold = await read('./data/gold.json');
const pred = await read('./results/predictions.json');
const pred2 = await read('./results/predictions-v2.json').catch(() => null); // 개선 프롬프트(v2) 결과, 없으면 생략
// 검증 세트(처음 보는 공지 30건): 정답과 v1·v2 결과. 없으면 생략
const goldH = await read('./data/gold-holdout.json').catch(() => null);
const predH1 = await read('./results/predictions-holdout.json').catch(() => null);
const predH2 = await read('./results/predictions-holdout-v2.json').catch(() => null);
const sample = await read('./data/sample.json');
// 규칙 기반 비교 기준(baseline_rules.py 결과). sets.sample·sets.holdout이 predictions 파일과 같은 모양. 없으면 생략
const base = await read('./results/baseline_results.json').catch(() => null);
const holdout = await read('./data/holdout.json').catch(() => null);

// 유료 등급 Standard 단가(USD / 100만 토큰, 2026-11 aistudio.google.com/docs/pricing). 출력에 생각 토큰 포함
const PRICE = { input: 0.25, output: 1.5 };
const KRW_PER_USD = 1400; // 가정

// 표현이 다른 같은 종류(연장운행) 공지 3건
const SHOWCASE = ['n01', 'n02', 'n06'];

// 틀린 사례의 원인 (결과를 읽고 사람이 단 메모)
const YEAR = '본문 끝 "MM-DD hh:mm:ss" 도장에 연도를 지어 붙임(입력에 연도 없음)';
const NOTES = {
  n01: YEAR, n02: YEAR, n03: YEAR, n07: YEAR, n09: YEAR, n11: YEAR, n12: YEAR,
  n13: YEAR, n14: YEAR, n15: YEAR, n16: YEAR, n18: YEAR,
  n04: '본문에 호선이 없는데 line "8": "구분: 8"(알림구분코드)을 호선으로 읽은 것으로 보임',
  n05: '표기 차이("1-8호선"). 뜻은 같음',
  n08: `"오늘밤 12시부터 운행 중단"을 막차 출발 00:00으로 씀. ${YEAR}`,
  n10: `line을 숫자만("6") 씀. ${YEAR}`,
  n17: `"상계역(23:21)에 진입"을 막차 시각으로 보지 않음(정답 해석도 논쟁적). ${YEAR}`,
  n19: `22:29 운행 중지를 막차와 무관으로 판정하면서 kind는 delay(서로 어긋남). ${YEAR}`,
  n24: '연장 "취소" 공지를 "막차 01:00 시간표 변경"으로 봄. 정답은 평소 기준(변경 없음)이라 관점 차이',
  n25: '막차와 무관한 공지에도 호선을 채움(정답 규칙: 무관이면 모두 null)',
  n27: '무관 공지에 line "5"·date를 채움. 날짜는 기간에서 바르게 읽었으나 정답 규칙상 null',
  n28: '"21시부터 막차시간까지 임시열차"를 연장운행으로 봄. line "2"는 숫자만',
  n29: `affects=false는 맞혔지만 kind를 early_end로 채움(affects와 kind가 어긋남). ${YEAR}`,
  n30: `21시대 4~5분 지연을 막차 영향으로 봄(정답의 "22시 이후" 기준이 프롬프트에 없음). ${YEAR}`,
};

// v2에서도 틀린 사례의 원인
const NOTES2 = {
  n04: '파업 철회 시 취소되는 "조건부" 연장 계획을 영향 없음으로 봄. 새 규칙 "연장 취소·미시행은 false"를 넓게 적용한 부작용으로 보임',
  n07: '본문 "10/12(토)"에 연도를 지어 붙임. 새 규칙은 "MM-DD hh:mm:ss" 도장만 말해서 다른 날짜 표기는 못 막음',
  n17: 'v1과 같음. "상계역(23:21) 진입"을 막차 시각으로 보지 않음(정답 해석도 논쟁적)',
  n28: 'v1과 같음. "21시부터 막차시간까지 임시열차"를 연장으로 봄. 날짜는 본문에서 바르게 읽었으나 정답 규칙상 null',
  n29: '무관 판정은 맞혔지만 line을 채움("false면 나머지 모두 null" 규칙을 어김)',
  n30: 'v1과 같음. 22시 규칙을 넣었는데도 21:18의 4~5분 지연을 막차 영향으로 봄',
};

// 검증 세트 v2에서 틀린 사례의 원인과, 검증 세트로 알게 된 것 (결과를 읽고 사람이 단 메모)
const NOTES_H = {
  h02: '시각 없이 "마지막 열차가 신용산역 도착 중"인 안내를 무관으로 봄. 정답(n17과 같은 기준)도 판단이 갈리는 경계 사례',
  h09: '파업 대비 "운행 간격 조정"을 무관으로 봄. 정답은 "시간표 변경은 영향" 기준(확신 low)이라 경계 사례',
  h20: '23:25 전 구간 운행 중지를 early_end로 봄. 정답 검토 때 delay/early_end가 갈린다고 적은 사례',
  h21: '21:15 지연을 막차 영향으로 봄. "22시 이후" 규칙의 경계',
  h23: '21:41 지연을 막차 영향으로 봄. "22시 이후" 규칙의 경계. 무관 정답이라 line도 틀림',
  h28: '낮(17:17) 지연인데 "타교통을 이용" 문구 때문에 영향 있다고 본 것으로 보임. 경계가 아닌 오답',
};
const HOLDOUT_TAKEAWAYS = [
  '**v2 규칙은 측정용 30건에만 맞춘 것이 아니었다.** 처음 보는 30건에서도 모두 맞음이 20.0% → 80.0%로 측정용과 같은 폭으로 올랐다.',
  '**다만 나아진 것은 주로 "값 쓰는 법"이다.** date·line·kind는 크게 올랐지만, 막차 영향 판단(affects_last_train)은 검증 세트에서 v1·v2 모두 83.3%로 그대로다.',
  '**v2에 남은 6건 중 5건은 정답을 달 때부터 판단이 갈린 경계 사례**다(21시대 지연, 간격 조정, 운행 중지의 종류, 시각 없는 막차 안내). 규칙을 더 붙이면 이 30건에 다시 맞추는 것이 된다.',
  '**모델의 confidence로는 틀린 답을 걸러낼 수 없다.** v2는 측정용·검증 60건 모두 confidence를 high로 냈고, 틀린 12건도 전부 high였다. 앱에서 "(추정)" 표시나 사람 확인에 쓰려면 confidence 대신 규칙(예: 21~22시 지연, 끝 시각 없는 중지)으로 경계 사례를 따로 표시해야 한다.',
  '**이 검증 세트의 한계**: 30건 중 19건이 막차와 무관해 형식만 맞추면 되는 쉬운 문제가 많고, 연장 공지가 없어 연장 판단이 일반화되는지는 재지 못했다. 30건이라 1건이 3.3%p다.',
];

// 규칙 기반 비교 기준이 틀린 사례의 원인, 원문을 보일 사례, 정리 (결과를 읽고 사람이 단 메모)
const NOTES_B = {}; // 측정용은 규칙을 이 30건의 정답을 보며 만들어 모두 맞음(외운 점수)
const NOTES_BH = {
  h02: '"지연"·"무정차" 같은 키워드가 없이 "마지막 열차가 신용산역에 도착"만 적힌 안내. 어느 규칙에도 걸리지 않아 무관',
  h09: '상투 문구 "정상운행 될 수 있도록 노력"을 "상황 종료"로 읽음. 또 "운행 간격이 조정"은 시간표 규칙("운행계획을 조정")에 없는 표현',
  h10: 'h09와 같은 상투 문구로 무관 판정. "시각표"는 "시간표"와 다른 글자라 못 잡음. 기간 칸이 비어 본문의 "\'22.11.30." 날짜도 못 읽음',
  h11: '"열차운행계획(평일) 일부 조정"처럼 단어 사이에 괄호·수식어가 끼어 "운행계획 조정" 정규식에 안 걸림',
  h12: '"휴일 열차운행계획 적용"은 "조정"·"시간표"가 없어 시간표 규칙에 안 걸림',
  h13: '"현재" 무정차인데 알림 시각 21:22가 규칙의 밤 기준(21:30)보다 이름. 시각 경계',
  h20: '"운행이 중지되었습니다"의 조사 "이" 때문에 "운행 중지" 정규식에 안 걸림. "김포골드라인"은 노선 사전에 없음',
  h22: '"운행은 중지 중"의 조사 "은"으로 못 잡음. 잡았더라도 알림 시각 21:28이 밤 기준 전이라 무관 판정',
  h23: '21:41의 지연을 밤 기준(21:30, 측정용 n18의 21:57에 맞춤) 이후로 보고 영향 있음. 정답은 22시 기준이라 무관. 시각 경계',
  h25: '"열차지연은 … 정상운행 개시"에서 지연이 끝났다는 뜻을 못 읽음. 측정용 n16("재개되었으나 … 지연운행")을 맞추려고 "지연이 있으면 종료로 안 본다"를 넣은 것이 반대로 작동',
};
const BASE_SHOW = ['h09', 'h11', 'h20', 'h25'];
const BASE_TAKEAWAYS = [
  '**규칙은 측정용에서 30/30이었지만 처음 보는 공지에서 20/30(66.7%)으로 떨어졌다.** AI(v2)는 두 세트 모두 80.0%였다. 규칙의 측정용 점수는 정답을 보며 만든 "외운 점수"라 비교에 쓰면 안 된다.',
  '**검증 세트의 66.7%도 대부분 "무관"을 맞힌 몫이다.** 검증 세트는 30건 중 19건이 무관이라, 모든 공지에 "무관"이라고만 답해도 19/30(63.3%)이 나온다. 실제로 막차에 영향이 있는 11건만 보면 규칙은 3건, AI(v2)는 8건을 모두 맞혔다.',
  '**규칙이 약했던 표현**: ① 조사·어순·동의어 변형("운행이 중지되었습니다", "운행은 중지 중", "운행계획(평일) 일부 조정", "시각표", "간격이 조정") ② 키워드가 놓인 문맥("정상운행 될 수 있도록 노력"은 종료가 아님, "지연은 … 정상운행 개시"는 지연이 아님) ③ 키워드 없이 상황만 적은 안내("마지막 열차가 … 도착"). 반대로 AI v1이 가장 많이 틀린 연도 없는 날짜와 "종착역 기준 02:00까지"는 규칙이 쉽게 처리했다(날짜는 기간 칸에서만 읽고, "…까지" 앞 새벽 시각을 읽음).',
  '**한계**: 30건이라 1건이 3.3%p이고, 규칙과 AI의 차이(4건)도 표본이 작다. 연장 공지가 검증 세트에 없어 연장 규칙은 처음 보는 공지로 재지 못했다. 규칙을 만든 사람(Claude)은 이전 단계에서 검증 세트의 정답 초안을 썼으므로 공지를 본 적이 있다. 규칙 작성 때 검증 세트를 다시 열지 않았고 규칙 고정 커밋(d864be5) 뒤에 한 번만 돌렸지만, 완전히 처음 보는 조건은 아니다.',
];

// 프롬프트 개선 아이디어 (결과를 읽고 사람이 단 메모)
const IDEAS = [
  '**연도**: 틀린 24건 중 21건이 date다. "본문 끝 MM-DD hh:mm:ss는 알림 시각이며, 연도가 적혀 있지 않으면 date는 null"을 프롬프트에 넣거나, 입력에 알림 발생 일시(`noftOcrnDt`, 연도 포함)를 한 줄 더 준다. 앱에서는 후자가 실용적이다.',
  '**호선 표기**: "line은 \'N호선\' 또는 노선 이름(예: 수인선), 여러 노선은 \'1~8호선\'"으로 형식을 정하고, "구분은 알림 종류 코드이지 호선이 아니다"를 적는다(n04·n10·n27·n28).',
  '**막차 영향 기준**: "막차 시각이 바뀌거나, 22시 이후 또는 운행 종료까지 이어지는 무정차·중단·지연만 true. 출퇴근 시간대 연장, 이미 끝난 상황, 연장 취소 안내는 false"를 명시한다(n24·n28·n30).',
  '**false일 때 모양**: "affects_last_train이 false면 changes는 kind none 한 개, 나머지는 null"을 적거나, 스키마에서 빈 배열을 허용한다(n25·n27·n29).',
  '**시각의 뜻**: new_last_departure는 막차 "출발" 시각이다. "종착역 기준 02시까지", "오늘밤 12시부터 중단", "24:46" 같은 표현의 정답 예시 2~3개(few-shot)를 넣는다(n08·n17).',
  '**응답 시간 꼬리**: 중앙값은 2초대지만 15~33초짜리가 있다. 앱에서 사용자 요청마다 부르지 말고, 서버가 공지를 받을 때 새 공지만 미리 해석해 저장(배치·캐시)한다.',
];

const FIELDS = ['affects_last_train', 'kind', 'line', 'date', 'new_last_departure'];
const norm = (v) => (typeof v === 'string' ? v.replace(/\s+/g, '') : v);
const pick = (o, f) => (f === 'affects_last_train' ? o?.affects_last_train : o?.changes?.[0]?.[f]) ?? null;
const same = (f, a, b) => (f === 'line' ? norm(a) === norm(b) : a === b);

const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;

// 예측 파일 하나를 채점해 일치·시간·토큰·비용을 모은다
function score(p, goldSet = gold) {
  const byId = Object.fromEntries(p.results.map((r) => [r.id, r]));
  const rows = goldSet.map((g) => {
    const r = byId[g.id];
    const out = r?.ok ? r.output : null;
    const hit = Object.fromEntries(FIELDS.map((f) => [f, out ? same(f, pick(g, f), pick(out, f)) : false]));
    return { g, r, out, hit, all: FIELDS.every((f) => hit[f]) };
  });
  const count = (f) => rows.filter((x) => x.hit[f]).length;
  const ok = rows.filter((x) => x.r?.ok);
  const ms = ok.map((x) => x.r.ms).sort((a, b) => a - b);
  const median = ms.length % 2 ? ms[(ms.length - 1) / 2] : (ms[ms.length / 2 - 1] + ms[ms.length / 2]) / 2;
  const tIn = avg(ok.map((x) => x.r.usage.input));
  const tOut = avg(ok.map((x) => x.r.usage.output + x.r.usage.thoughts));
  return {
    rows, count, ok, ms, median, tIn, tOut,
    allCount: rows.filter((x) => x.all).length,
    noDate: rows.filter((x) => FIELDS.every((f) => f === 'date' || x.hit[f])).length,
    tThought: avg(ok.map((x) => x.r.usage.thoughts)),
    usd: (tIn * PRICE.input + tOut * PRICE.output) / 1e6,
    retried: ok.filter((x) => x.r.retries?.length),
  };
}

const { rows, count, ok, ms, median, tIn, tOut, allCount, tThought, usd, retried } = score(pred);
const n = rows.length;
const pct = (k) => `${((k / n) * 100).toFixed(1)}%`;

const fmt = (v) => (v === null || v === undefined ? 'null' : typeof v === 'string' ? `"${v}"` : String(v));
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const LABEL = { affects_last_train: 'affects_last_train', kind: 'kind', line: 'line', date: 'date', new_last_departure: 'new_last_departure' };

const md = [];
md.push('# 운행 공지 해석 정확도 측정');
md.push('');
md.push(`- 모델: \`${pred.model}\` (Gemini API 무료 등급, thinkingLevel \`${pred.thinkingLevel}\`, JSON 스키마 강제)`);
md.push(`- 데이터: 공공데이터포털 「서울교통공사_지하철알림정보」 공지 1,316건 중 막차 관련 표현이 다른 ${n}건 (연장 6 · 조기 종료 2 · 무정차 5 · 지연 6 · 시간표 2 · 막차와 무관 9)`);
md.push(`- 정답: 사람이 직접 단 정답과 비교. changes가 여러 개면 첫 항목으로 채점, null과 null은 일치, 시각은 HH:MM 문자열이 정확히 같아야 일치`);
md.push(`- 실행: ${pred.ranAt.slice(0, 10)}, 공지 1건씩 순서대로 호출(간격 ${pred.gapMs / 1000}초)`);
md.push('');
md.push('## 핵심 숫자');
md.push('');
md.push('| 지표 | 값 |');
md.push('|---|---|');
md.push(`| 다섯 항목 모두 맞은 비율 | **${pct(allCount)}** (${allCount}/${n}) |`);
md.push(`| 평균 응답 시간 | **${(avg(ms) / 1000).toFixed(2)}초** (중앙값 ${(median / 1000).toFixed(2)}초, 최대 ${(ms.at(-1) / 1000).toFixed(2)}초) |`);
md.push(`| 공지 1건당 비용(유료 단가 기준) | **$${usd.toFixed(6)}** ≈ ${(usd * KRW_PER_USD).toFixed(3)}원 · 1만 건 ≈ ${Math.round(usd * 1e4 * KRW_PER_USD).toLocaleString()}원 |`);
md.push('');
if (pred2) {
  const s2 = score(pred2);
  md.push(`위는 제안서 프롬프트(v1) 결과다. 틀린 원인을 보고 규칙·예시를 보탠 개선 프롬프트(v2)는 모두 맞음 **${pct(s2.allCount)}** (${s2.allCount}/${n}), 평균 ${(avg(s2.ms) / 1000).toFixed(2)}초, 1건당 약 ${(s2.usd * KRW_PER_USD).toFixed(2)}원이다(아래 "프롬프트 개선 후"). 처음 보는 공지 30건(검증 세트)에서도 v2는 ${predH2 && goldH ? `${score(predH2, goldH).allCount}/${goldH.length}` : "-"}건이 모두 맞았다(아래 "검증 세트").`);
  md.push('');
}
md.push(`무료 등급은 비용이 들지 않는다(대신 입력이 제품 개선에 쓰일 수 있음). 비용은 유료 Standard 단가 입력 $${PRICE.input}·출력 $${PRICE.output} / 100만 토큰, 환율 ${KRW_PER_USD.toLocaleString()}원/달러 가정.`);
md.push('');
md.push('## 항목별 일치율');
md.push('');
md.push('| 항목 | 일치 | 비율 |');
md.push('|---|---|---|');
for (const f of FIELDS) md.push(`| ${LABEL[f]} | ${count(f)}/${n} | ${pct(count(f))} |`);
md.push(`| **모두 맞음** | ${allCount}/${n} | **${pct(allCount)}** |`);
const { noDate } = score(pred);
md.push(`| (참고) date 빼고 모두 맞음 | ${noDate}/${n} | ${pct(noDate)} |`);
md.push('');
md.push('date가 낮은 까닭: 공지 본문에는 연도 없이 "MM-DD hh:mm:ss"만 있어 정답은 대부분 null인데, 모델이 연도를 지어 붙였다(아래 "틀린 사례").');
md.push('');
md.push('## 응답 시간과 토큰');
md.push('');
md.push('| 지표 | 값 |');
md.push('|---|---|');
md.push(`| 성공한 호출 | ${ok.length}/${n} |`);
md.push(`| 응답 시간 평균 / 중앙값 / 최대 | ${Math.round(avg(ms)).toLocaleString()}ms / ${Math.round(median).toLocaleString()}ms / ${ms.at(-1).toLocaleString()}ms |`);
md.push(`| 3초 안에 끝난 비율 | ${pct(ms.filter((v) => v <= 3000).length)} |`);
md.push(`| 공지 1건당 평균 토큰 | 입력 ${Math.round(tIn)} · 출력 ${Math.round(tOut)} (생각 ${Math.round(tThought)} 포함) |`);
md.push(`| 재시도 | ${retried.length}건 (${retried.map((x) => `${x.g.id}: HTTP ${x.r.retries.map((t) => t.status).join(',')}`).join(', ') || '없음'}) |`);
md.push('');
md.push('응답 시간은 재시도 대기 시간을 빼고 마지막 호출 한 번만 잰 값이다.');
md.push('');
md.push('## 같은 "연장운행"도 문장이 제각각이다');
md.push('');
for (const id of SHOWCASE) {
  const row = rows.find((x) => x.g.id === id);
  const s = sample.find((x) => x.id === id);
  md.push(`### ${id}. ${s.noftTtl}`);
  md.push('');
  md.push('공지 원문:');
  md.push('');
  md.push('```text');
  md.push(toInput(s));
  md.push('```');
  md.push('');
  md.push(`모델 출력 (${row.r.ms.toLocaleString()}ms, ${row.all ? '정답과 모두 일치' : `틀린 항목: ${FIELDS.filter((f) => !row.hit[f]).join(', ')}`}):`);
  md.push('');
  md.push('```json');
  md.push(JSON.stringify(row.out, null, 2));
  md.push('```');
  md.push('');
}
md.push('## 틀린 사례와 원인');
md.push('');
const wrong = rows.filter((x) => !x.all);
md.push(`${n}건 중 ${wrong.length}건에서 한 항목 이상 틀렸다.`);
md.push('');
md.push('| id | 공지 | 틀린 항목 (정답 → 모델) | 원인 |');
md.push('|---|---|---|---|');
for (const x of wrong) {
  const diff = FIELDS.filter((f) => !x.hit[f]).map((f) => `${f}: ${fmt(pick(x.g, f))} → ${fmt(pick(x.out, f))}`).join('<br>');
  md.push(`| ${x.g.id} | ${cell(x.g.title)} | ${cell(diff)} | ${cell(NOTES[x.g.id] ?? '')} |`);
}
md.push('');
if (IDEAS.length) {
  md.push('## 프롬프트 개선 아이디어');
  md.push('');
  for (const i of IDEAS) md.push(`- ${i}`);
  md.push('');
}

if (pred2) {
  const s1 = score(pred);
  const s2 = score(pred2);
  const row = (label, f1, f2) => md.push(`| ${label} | ${f1(s1)} | ${f2 ? f2(s2) : f1(s2)} |`);
  const frac = (k) => `${k}/${n} (${pct(k)})`;
  md.push('## 프롬프트 개선 후 (v2)');
  md.push('');
  md.push('위 아이디어 중 응답 시간을 뺀 다섯 가지를 시스템 프롬프트에 규칙으로 보태고, 지어낸 공지 예시 3건(few-shot)을 넣었다. 입력 형식·정답·모델·설정은 v1과 같다. 전체 프롬프트는 `notice-parse.js`의 `V2`.');
  md.push('');
  md.push('| 지표 | v1 (제안서 프롬프트) | v2 (개선) |');
  md.push('|---|---|---|');
  for (const f of FIELDS) row(LABEL[f], (s) => frac(s.count(f)));
  row('**모두 맞음**', (s) => `**${frac(s.allCount)}**`);
  row('평균 응답 시간', (s) => `${(avg(s.ms) / 1000).toFixed(2)}초 (중앙값 ${(s.median / 1000).toFixed(2)}초, 최대 ${(s.ms.at(-1) / 1000).toFixed(2)}초)`);
  row('공지 1건당 토큰', (s) => `입력 ${Math.round(s.tIn)} · 출력 ${Math.round(s.tOut)}`);
  row('공지 1건당 비용', (s) => `$${s.usd.toFixed(6)} ≈ ${(s.usd * KRW_PER_USD).toFixed(3)}원`);
  md.push('');
  md.push('v2가 입력이 더 긴데도 빨랐던 것은 프롬프트 효과라기보다 서버 응답 편차로 보인다(v1에만 15~33초짜리 호출이 섞임). 응답 시간은 여러 번 재야 비교할 수 있다.');
  md.push('');
  md.push('v2는 규칙과 예시 때문에 입력 토큰이 약 4배로 늘었다. 공지 1건당 비용은 그만큼 오르지만 여전히 1원 아래다. 같은 지시문을 반복해 보내므로 컨텍스트 캐시를 쓰면 더 줄일 수 있다.');
  md.push('');
  md.push('**주의**: v2의 규칙은 이 30건에서 틀린 원인을 보고 만들었다(예시 공지는 따로 지어냄). 그래서 v2 점수는 처음 보는 공지에서보다 높게 나왔을 수 있다. 그래서 처음 보는 공지 30건으로 다시 쟀다(아래 "검증 세트").');
  md.push('');
  const wrong2 = s2.rows.filter((x) => !x.all);
  md.push(`### v2에서도 틀린 사례 (${wrong2.length}건)`);
  md.push('');
  md.push('| id | 공지 | 틀린 항목 (정답 → 모델) | 원인 |');
  md.push('|---|---|---|---|');
  for (const x of wrong2) {
    const diff = FIELDS.filter((f) => !x.hit[f]).map((f) => `${f}: ${fmt(pick(x.g, f))} → ${fmt(pick(x.out, f))}`).join('<br>');
    md.push(`| ${x.g.id} | ${cell(x.g.title)} | ${cell(diff)} | ${cell(NOTES2[x.g.id] ?? '')} |`);
  }
  md.push('');
}

if (pred2 && goldH && predH1 && predH2) {
  const sets = [score(pred), score(pred2), score(predH1, goldH), score(predH2, goldH)];
  const nh = goldH.length;
  const fr = (k, m) => `${k}/${m} (${((k / m) * 100).toFixed(1)}%)`;
  const line = (label, f) => md.push(`| ${label} | ${sets.map((s, i) => f(s, i < 2 ? n : nh)).join(' | ')} |`);
  const kinds = {};
  for (const g of goldH) {
    const k = g.affects_last_train ? g.changes[0].kind : 'none';
    kinds[k] = (kinds[k] ?? 0) + 1;
  }
  md.push('## 검증 세트: 처음 보는 공지 30건');
  md.push('');
  md.push(`v2 규칙이 측정용 30건에 맞춰졌는지 보려고, 측정용과 겹치지 않는 공지 ${nh}건을 따로 뽑아 정답을 달고(사람 검토) 같은 설정으로 다시 쟀다.`);
  md.push('');
  md.push('- 뽑는 법: 측정용 공지와 2글자 묶음이 80% 넘게 겹치는 공지(다시 올린 공지)는 빼고, 막차·연장 / 시간표·조정 / 밤(21~01시) 무정차 / 밤 지연·중단 / 낮 묶음에서 고정 시드로 무작위 추출(`notice-holdout.js`)');
  md.push(`- 정답 구성: ${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(' · ')}. **연장(extend) 공지가 없다.** 표현이 다른 막차 연장 공지는 측정용이 다 가져갔고, 남은 "연장운행"은 모두 출퇴근 시간대 연장(무관)이다`);
  md.push('');
  md.push('| 지표 | 측정용 v1 | 측정용 v2 | 검증 v1 | 검증 v2 |');
  md.push('|---|---|---|---|---|');
  for (const f of FIELDS) line(LABEL[f], (s, m) => fr(s.count(f), m));
  line('**모두 맞음**', (s, m) => `**${fr(s.allCount, m)}**`);
  line('평균 응답 시간', (s) => `${(avg(s.ms) / 1000).toFixed(2)}초`);
  line('공지 1건당 비용', (s) => `${(s.usd * KRW_PER_USD).toFixed(2)}원`);
  md.push('');
  const [, , h1, h2] = sets;
  for (const [label, s, notes] of [['v1', h1, {}], ['v2', h2, NOTES_H]]) {
    const wrong = s.rows.filter((x) => !x.all);
    md.push(`### 검증 세트 ${label}에서 틀린 사례 (${wrong.length}건)`);
    md.push('');
    md.push('| id | 공지 | 틀린 항목 (정답 → 모델) | 원인 |');
    md.push('|---|---|---|---|');
    for (const x of wrong) {
      const diff = FIELDS.filter((f) => !x.hit[f]).map((f) => `${f}: ${fmt(pick(x.g, f))} → ${fmt(pick(x.out, f))}`).join('<br>');
      md.push(`| ${x.g.id} | ${cell(x.g.title)} | ${cell(diff)} | ${cell(notes[x.g.id] ?? '')} |`);
    }
    md.push('');
  }
  for (const t of HOLDOUT_TAKEAWAYS) md.push(`- ${t}`);
  if (HOLDOUT_TAKEAWAYS.length) md.push('');
}

if (base?.sets.sample && pred2) {
  const bS = score(base.sets.sample);
  const bH = base.sets.holdout && goldH ? score(base.sets.holdout, goldH) : null;
  const aS = score(pred2);
  const aH = predH2 && goldH ? score(predH2, goldH) : null;
  const fr = (s, k) => (s ? `${k(s)}/${s.rows.length} (${((k(s) / s.rows.length) * 100).toFixed(1)}%)` : '-');
  md.push('## 규칙 기반 비교: AI 없이 정규식만으로는');
  md.push('');
  md.push(`LLM을 쓰지 않는 규칙 추출기(\`baseline_rules.py\`: 정규식·키워드·시각 파싱, 규칙 ${base.ruleCount}개, 코드 ${base.codeLines}줄)를 같은 입력·같은 스키마로 돌려 위와 같은 채점 함수로 쟀다. 규칙은 측정용 30건만 보고 만들었고, 검증 세트는 규칙을 고정·커밋한 뒤 한 번만 돌렸다(결과를 보고 고치지 않음).`);
  md.push('');
  md.push('| 지표 | 규칙 · 측정용 | 규칙 · 검증 | AI v2 · 측정용 | AI v2 · 검증 |');
  md.push('|---|---|---|---|---|');
  const sets = [bS, bH, aS, aH];
  for (const f of FIELDS) md.push(`| ${LABEL[f]} | ${sets.map((s) => fr(s, (x) => x.count(f))).join(' | ')} |`);
  md.push(`| **모두 맞음** | ${sets.map((s) => `**${fr(s, (x) => x.allCount)}**`).join(' | ')} |`);
  md.push('');
  for (const [label, s, notes, src] of [['측정용', bS, NOTES_B, sample], ['검증 세트', bH, NOTES_BH, holdout]]) {
    if (!s) continue;
    const wrong = s.rows.filter((x) => !x.all);
    md.push(`### 규칙이 틀린 사례: ${label} (${wrong.length}건)`);
    md.push('');
    if (!wrong.length) {
      md.push('없음. 규칙을 이 30건의 정답을 보며 만들었기 때문이다(외운 점수).');
      md.push('');
      continue;
    }
    md.push('| id | 공지 | 틀린 항목 (정답 → 규칙) | 원인 |');
    md.push('|---|---|---|---|');
    for (const x of wrong) {
      const diff = FIELDS.filter((f) => !x.hit[f]).map((f) => `${f}: ${fmt(pick(x.g, f))} → ${fmt(pick(x.out, f))}`).join('<br>');
      md.push(`| ${x.g.id} | ${cell(x.g.title)} | ${cell(diff)} | ${cell(notes[x.g.id] ?? '')} |`);
    }
    md.push('');
    for (const id of BASE_SHOW.filter((i) => wrong.some((x) => x.g.id === i))) {
      md.push(`${id} 원문:`);
      md.push('');
      md.push('```text');
      md.push(toInput(src.find((n) => n.id === id)));
      md.push('```');
      md.push('');
    }
  }
  for (const t of BASE_TAKEAWAYS) md.push(`- ${t}`);
  if (BASE_TAKEAWAYS.length) md.push('');
  // baseline_results.json에 채점 결과를 붙인다(예측은 baseline_rules.py가 씀)
  const summary = (s) => s && {
    n: s.rows.length,
    allCorrect: s.allCount,
    allCorrectRate: +((s.allCount / s.rows.length) * 100).toFixed(1),
    fields: Object.fromEntries(FIELDS.map((f) => [f, s.count(f)])),
    wrong: s.rows.filter((x) => !x.all).map((x) => ({ id: x.g.id, fields: FIELDS.filter((f) => !x.hit[f]) })),
  };
  base.score = { scoredBy: 'notice-eval.js score()', sample: summary(bS), holdout: summary(bH) };
  await writeFile(new URL('./results/baseline_results.json', import.meta.url), JSON.stringify(base, null, 2) + '\n');
  console.log('규칙 모두 맞음', `측정용 ${bS.allCount}/30`, bH ? `검증 ${bH.allCount}/30` : '');
  for (const x of [...bS.rows, ...(bH?.rows ?? [])].filter((r) => !r.all)) {
    console.log(' ', x.g.id, FIELDS.filter((f) => !x.hit[f]).map((f) => `${f}: ${fmt(pick(x.g, f))} → ${fmt(pick(x.out, f))}`).join(' | '));
  }
}

md.push('## 재현');
md.push('');
md.push('```bash');
md.push('node --env-file=.env notice-fetch.js   # 공지 받기, 표본 만들기');
md.push('node --env-file=.env notice-parse.js   # Gemini 호출 (제안서 프롬프트 v1)');
md.push('node --env-file=.env notice-parse.js --prompt v2   # 개선 프롬프트');
md.push('node notice-holdout.js                       # 검증 세트 뽑기 (정답은 data/gold-holdout.json)');
md.push('node --env-file=.env notice-parse.js --set holdout --prompt v1');
md.push('node --env-file=.env notice-parse.js --set holdout --prompt v2');
md.push('python3 baseline_rules.py --set sample        # 규칙 기반 비교 기준 (측정용)');
md.push('python3 baseline_rules.py --set holdout       # 규칙 기반 (검증 세트, 한 번만)');
md.push('node notice-eval.js                          # 이 보고서');
md.push('```');
md.push('');

await writeFile(new URL('./results/notice-eval.md', import.meta.url), md.join('\n'));
console.log(`모두 맞음 ${allCount}/${n}`, Object.fromEntries(FIELDS.map((f) => [f, count(f)])));
for (const x of wrong) {
  console.log(x.g.id, FIELDS.filter((f) => !x.hit[f]).map((f) => `${f}: ${fmt(pick(x.g, f))} → ${fmt(pick(x.out, f))}`).join(' | '));
}
