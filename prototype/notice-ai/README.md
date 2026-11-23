# 운행 공지 AI 해석 시제품

서울교통공사 운행 공지(연장 운행, 무정차 통과, 지연, 시간표 변경 등)를 LLM으로 읽어 "막차에 영향이 있는지, 어느 노선·날짜·시각인지"를 JSON으로 뽑는 실험이다. 앱에는 아직 들어가지 않았다.

- 모델: Gemini 3.1 Flash-Lite (`gemini-3.1-flash-lite`, thinkingLevel `MINIMAL`, JSON 스키마 강제)
- 비교 기준: LLM 없이 정규식·키워드로 같은 값을 뽑는 규칙 추출기(`baseline_rules.py`, 규칙 23개)
- 자세한 측정 결과와 틀린 사례 전체: [`results/notice-eval.md`](results/notice-eval.md)

## 실험 방법

**데이터**
- 공공데이터포털 「서울교통공사_지하철알림정보」(15144070) 공지 1,316건 전체 (`data/notices.json`)
- 공지 발생 일시 2016-11-22 ~ 2026-11-01, 수집일 2026-11-18

**세트 구성** (정답은 사람이 직접 검토)
- 측정용 30건 (`data/sample.json`, 정답 `data/gold.json`): 막차 관련 표현이 서로 다른 공지를 골랐다. 연장 6 · 조기 종료 2 · 무정차 5 · 지연 6 · 시간표 2 · 막차와 무관 9
- 처음 보는 공지 30건 (`data/holdout.json`, 정답 `data/gold-holdout.json`): 측정용과 겹치지 않는 공지를 고정 시드로 무작위 추출(`notice-holdout.js`). 본문이 80% 넘게 같은 재게시 공지는 뺐다. 무관 19 · 지연 4 · 시간표 5 · 무정차 2. 이 중 막차에 영향이 있는 공지는 11건

**프롬프트** (`notice-parse.js`)
- 기본(`V1`): 제안서에 적은 프롬프트
- 개선(`V2`): 측정용 30건에서 틀린 원인을 보고 규칙 다섯 가지와 지어낸 예시 공지 3건을 더했다

**채점** (`notice-eval.js`)
- 다섯 항목(`affects_last_train`, `kind`, `line`, `date`, `new_last_departure`)이 모두 정답과 같아야 "맞음"
- 변경이 여러 개면 첫 항목으로 채점, null과 null은 일치, 시각은 `HH:MM` 문자열이 정확히 같아야 일치
- 규칙 추출기는 측정용 30건만 보고 만들어 고정·커밋(d864be5)한 뒤, 처음 보는 공지에 한 번만 돌렸다

## 결과

"모두 맞음" 비율이다.

| 방식 | 측정용 30건 | 처음 보는 공지 30건 | 그중 막차 영향 11건 |
|---|---|---|---|
| 규칙(정규식, 규칙 23개) | 비교 제외 | 66.7% | 3건 |
| AI 기본 프롬프트 | 20.0% | 20.0% | — |
| AI 개선 프롬프트 | 80.0% | 80.0% | 8건 |
| 모두 '무관'으로 답할 때 | — | 63.3% | 0건 |

- 규칙의 측정용 점수(30/30)는 정답을 보며 만든 점수라 비교에서 뺐다.
- 처음 보는 공지는 30건 중 19건이 무관이라, 모두 "무관"이라고만 답해도 63.3%가 나온다. 그래서 막차에 영향이 있는 11건을 따로 셌다.
- 개선 프롬프트에서 1건 처리 시간은 평균 2.29초, 비용은 유료 단가 기준 약 0.75원이다(측정용 기준).

## 재현

Node 20.6 이상(`--env-file`), Python 3 (표준 라이브러리만). 이 폴더에서 실행한다.

```bash
cp .env.example .env   # DATA_GO_KR_KEY, GEMINI_API_KEY 입력
```

API 호출 없이 저장된 결과로 채점만 다시 하기:

```bash
node notice-eval.js    # results/notice-eval.md 다시 생성
```

처음부터 다시 하기:

```bash
node --env-file=.env notice-fetch.js                         # 공지 수집 + 측정용 후보
node notice-holdout.js                                       # 처음 보는 공지 30건 추출
node --env-file=.env notice-parse.js --prompt v1             # 측정용, 기본 프롬프트
node --env-file=.env notice-parse.js --prompt v2             # 측정용, 개선 프롬프트
node --env-file=.env notice-parse.js --set holdout --prompt v1
node --env-file=.env notice-parse.js --set holdout --prompt v2
python3 baseline_rules.py --set sample                       # 규칙, 측정용
python3 baseline_rules.py --set holdout                      # 규칙, 처음 보는 공지 (결과가 있으면 거부)
node notice-eval.js
```

공지는 계속 올라오므로 `notice-fetch.js`를 다시 돌리면 1,316건과 달라진다. LLM 응답도 호출마다 조금씩 다를 수 있다.

## 한계

- 표본이 30건씩이라 1건이 3.3%p다. 규칙과 AI의 차이(처음 보는 공지에서 4건)도 작은 표본에서 나온 값이다.
- 처음 보는 공지 30건에는 막차 연장 공지가 없다. 표현이 다른 연장 공지는 측정용이 다 가져갔고, 남은 "연장운행"은 출퇴근 시간대 연장(무관)뿐이었다. 연장 판단이 처음 보는 공지에도 통하는지는 재지 못했다.
- 규칙을 만든 쪽은 이전 단계에서 처음 보는 공지의 정답 초안을 쓰면서 그 공지들을 본 적이 있다. 규칙을 쓸 때 다시 열지 않았고 고정 뒤 한 번만 돌렸지만, 완전히 처음 보는 조건은 아니다.
- 모델이 스스로 매긴 confidence는 틀린 답을 거르지 못했다(개선 프롬프트 60건 모두 high, 틀린 12건도 high).
