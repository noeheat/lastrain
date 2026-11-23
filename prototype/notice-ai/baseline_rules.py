# 운행 공지 해석의 규칙 기반 비교 기준(baseline): LLM 없이 정규식·키워드·시각 파싱만 쓴다
# AI와 같은 입력(제목·내용·구분·기간, notice-input.js의 toInput과 같은 칸)과 같은 JSON 스키마로 낸다.
# 규칙은 측정용 30건(sample.json + gold.json)만 보고 만들었다. 검증 세트(holdout.json)는 규칙을 고정한 뒤 한 번만 돌린다.
# 실행: python3 baseline_rules.py --set sample    (측정용, 몇 번이든)
#       python3 baseline_rules.py --set holdout   (검증 세트, 이미 결과가 있으면 거부)
# 결과: results/baseline_results.json (notice-parse.js의 predictions 파일과 같은 모양). 채점은 node notice-eval.js
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "results" / "baseline_results.json"

# ── 규칙 ──────────────────────────────────────────────────────────────
# 1) 막차와 무관: 연장 취소·미시행, 상황 종료
R_CANCEL = re.compile(r"미시행|시행하지\s*않|실시하지\s*않|취소되었|유보")
R_ENDED = re.compile(r"정상\s*운행|무정차\s*통과\s*종료")
# 2) 연장: "연장" + 막차를 가리키는 말, 또는 밤늦게 끝나는 임시열차
R_EXTEND = re.compile(r"연장")
R_LAST_WORD = re.compile(r"막차|마지막\s*열차|종착역\s*기준|연장운행\s*계획")
R_TEMP_TRAIN = re.compile(r"임시\s*열차")
R_LATE_END = re.compile(r"익일|\b2[4-9]:\d{2}")
# 3) 조기 종료: 막차 운휴, 오늘 밤 운행 중단
R_EARLY = re.compile(r"운휴|(오늘\s*밤|막차|\d+시부터).{0,40}(운행을?\s*중단)")
# 4) 시간표 변경
R_TIMETABLE = re.compile(r"시간표|운행\s*계획을?\s*조정|감축\s*운행")
# 5) 무정차, 6) 지연·운행 중지
R_SKIP = re.compile(r"무정차")
R_DELAY = re.compile(r"지연|운행\s*중지|운행\s*중단|운행중지|운행중단")
R_UNTIL_END = re.compile(r"(운행|영업)\s*종료\s*시?\s*까지")
# 시각 읽기
R_STAMP = re.compile(r"\b\d{2}-\d{2} (\d{2}):(\d{2}):\d{2}")  # 본문 끝 알림 시각 도장(연도 없음)
R_HHMM = re.compile(r"(?<![\d:-])(\d{1,2}):(\d{2})(?!:\d)")
R_HH_SI = re.compile(r"(\d{1,2})\s*시\s*(?:(\d{1,2})\s*분)?")
R_UNTIL = re.compile(r"(\d{1,2})(?::(\d{2})|\s*시)?\s*까지")
R_LAST_AT = re.compile(r"마지막\s*열차.{0,40}?\((\d{1,2}):(\d{2})\)")
# 호선
R_LINE_RANGE = re.compile(r"(\d)\s*[~-]\s*(\d)\s*호선")
R_LINE = re.compile(r"(\d)\s*호선")
R_NAMED_LINE = re.compile(r"(수인선|경의선|중앙선|경춘선|안산선|과천선|분당선|신분당선|공항철도|경강선|서해선)")
R_STATION = re.compile(r"([가-힣]{2,})역")
R_DELAY_MIN = re.compile(r"(\d+)(?:\s*~\s*(\d+))?\s*분\s*(?:정도\s*)?지연")

NIGHT_FROM = 21 * 60 + 30  # 이 시각(21:30) 이후에 진행 중인 지연·무정차는 막차에 영향
SKIP_AFTER = 22 * 60  # 무정차가 이 시각(22:00)을 넘겨 이어지면 막차에 영향

# ── 도우미 ────────────────────────────────────────────────────────────
def minutes(h, m=0):
    return int(h) * 60 + int(m or 0)


def hhmm(total):
    total %= 24 * 60  # 24:46 → 00:46
    return f"{total // 60:02d}:{total % 60:02d}"


def body_times(text):
    """본문에 적힌 사건 시각(분). 알림 도장은 뺀다. 01시 이전은 다음 날로 본다(24시+)."""
    text = R_STAMP.sub("", text)
    out = [minutes(h, m) for h, m in R_HHMM.findall(text) if int(h) <= 29]
    out += [minutes(h, m) for h, m in R_HH_SI.findall(text) if int(h) <= 29]
    return [t + 24 * 60 if t < 4 * 60 else t for t in out]


def stamp_time(text):
    s = R_STAMP.findall(text)
    if not s:
        return None
    t = minutes(*s[-1])
    return t + 24 * 60 if t < 4 * 60 else t


def find_line(title, content):
    for text in (title, content):
        r = R_LINE_RANGE.search(text)
        if r:
            return f"{r.group(1)}~{r.group(2)}호선"
    r = R_LINE.search(title)
    if r:
        return f"{r.group(1)}호선"
    # 본문에서 처음 나오는 호선(숫자 또는 이름)
    hits = [(m.start(), f"{m.group(1)}호선") for m in R_LINE.finditer(content)]
    hits += [(m.start(), m.group(1)) for m in R_NAMED_LINE.finditer(content)]
    return min(hits)[1] if hits else None


def extend_last(content):
    """연장 막차 시각: '…까지' 앞의 새벽 시각(00~03시), 또는 24시 넘는 표기."""
    cands = []
    for h, m in R_UNTIL.findall(R_STAMP.sub("", content)):
        if int(h) <= 3:
            cands.append(minutes(h, m))
    for h, m in R_HHMM.findall(R_STAMP.sub("", content)):
        if 24 <= int(h) <= 29:
            cands.append(minutes(h, m))
    return hhmm(cands[-1]) if cands else None


def classify(title, content):
    """(affects, kind) 판정. 규칙 순서가 우선순위다."""
    text = f"{title} {content}"
    if R_CANCEL.search(text):
        return False, "none"
    if R_ENDED.search(text) and not R_DELAY.search(content):
        return False, "none"
    if R_EXTEND.search(text) and R_LAST_WORD.search(text):
        return True, "extend"
    if R_TEMP_TRAIN.search(text) and R_LATE_END.search(text):
        return True, "extend"
    if R_EARLY.search(text):
        return True, "early_end"
    if R_TIMETABLE.search(text):
        return True, "timetable"
    now = stamp_time(content)
    late = lambda t: t is not None and t >= NIGHT_FROM
    if R_SKIP.search(text):
        times = body_times(content)
        if R_UNTIL_END.search(content) or any(t > SKIP_AFTER for t in times):
            return True, "skip"
        if not times and late(now):  # 시각 없이 "현재 무정차 중"
            return True, "skip"
        return False, "none"
    if R_DELAY.search(text):
        return (True, "delay") if late(now) else (False, "none")
    return False, "none"


def extract(n):
    title, content = n["noftTtl"] or "", n["noftCn"] or ""
    affects, kind = classify(title, content)
    change = {k: None for k in ("line", "from_station", "to_station", "kind", "date", "new_last_departure", "delay_minutes")}
    change["kind"] = kind
    if affects:
        change["line"] = find_line(title, content)
        begin = n.get("xcseSitnBgngDt")
        change["date"] = begin[:10] if begin else None
        if kind == "extend":
            change["new_last_departure"] = extend_last(content)
        elif kind == "delay":
            r = R_LAST_AT.search(content)
            change["new_last_departure"] = f"{int(r.group(1)):02d}:{r.group(2)}" if r else None
            d = R_DELAY_MIN.search(content)
            change["delay_minutes"] = int(d.group(2) or d.group(1)) if d else None
        if kind in ("skip", "delay"):
            s = R_STATION.search(f"{title} {content}")
            change["from_station"] = s.group(1) if s else None
    return {
        "affects_last_train": affects,
        "changes": [change],
        "confidence": "medium",  # 규칙은 확신도를 내지 않음(스키마를 맞추려는 고정값)
        "summary": title,
    }


def count_rules():
    """규칙 수 = R_로 시작하는 정규식 + 시각 기준 2개(NIGHT_FROM, SKIP_AFTER)"""
    return sum(1 for k, v in globals().items() if k.startswith("R_") and isinstance(v, re.Pattern)) + 2


def main():
    s = sys.argv[sys.argv.index("--set") + 1] if "--set" in sys.argv else "sample"
    if s not in ("sample", "holdout"):
        sys.exit("--set은 sample/holdout 중 하나")
    prev = json.loads(OUT.read_text()) if OUT.exists() else {"sets": {}}
    if s == "holdout" and "holdout" in prev["sets"]:
        sys.exit("검증 세트는 한 번만 돌린다. 이미 결과가 있어 멈춤")
    notices = json.loads((HERE / "data" / f"{s}.json").read_text())
    results = []
    for n in notices:
        t0 = time.perf_counter()
        out = extract(n)
        ms = (time.perf_counter() - t0) * 1000
        usage = {"input": 0, "output": 0, "thoughts": 0, "total": 0}
        results.append({"id": n["id"], "ok": True, "ms": ms, "retries": [], "usage": usage, "output": out})
        c = out["changes"][0]
        print(n["id"], out["affects_last_train"], c["kind"], c["line"], c["date"], c["new_last_departure"])
    code_lines = sum(1 for l in Path(__file__).read_text().splitlines() if l.strip() and not l.strip().startswith("#"))
    prev.update({
        "method": "규칙 기반(정규식·키워드·시각 파싱, LLM 없음)",
        "rulesBuiltFrom": "sample.json 30건과 gold.json만 보고 작성",
        "ruleCount": count_rules(),
        "codeLines": code_lines,
    })
    prev["sets"][s] = {"set": s, "ranAt": datetime.now(timezone.utc).isoformat(), "results": results}
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(prev, ensure_ascii=False, indent=2) + "\n")
    print(f"저장: {s} {len(results)}건, 규칙 {prev['ruleCount']}개, 코드 {code_lines}줄")


if __name__ == "__main__":
    main()
