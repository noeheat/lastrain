---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: ["components/Countdown.tsx","components/LastTrainApp.tsx","components/Sheet.tsx","components/PersonSheet.tsx"]
---

# 홈 카운트다운 + 시트 (앱 화면)

- 범위: `/` 한 화면 — 빈 상태, 사람별 카운트다운, 출발역·사람 편집 시트. 모드 **Operate**.
- 사용자: 밤 23~01시, 같은 역에서 헤어지는 두 사람(최대 6명). 대화 중 힐끗 본다.
- 할 일: 각자 막차까지 몇 분 남았는지 보기, 사람 넘겨 보기, 사람·출발역 고치기.
- 상태: 여유·주의·급함·놓침, 다시 확인(출발역 바뀜), 버스 실시간(앞당김·늦음), 빈 상태, 막차 없음.
- 피할 것: AI가 만든 티(그라데이션·유리·네온·흔한 다크 UI).

## Direction contract

THESIS: 한 사람이 화면 전체를 차지하는 세로 피드. 다음 사람은 한 번 위로 넘기면 된다. 가운데 큰 숫자 하나와 아래 칩 줄로 된 "타이머 대시보드" 배치는 쓰지 않는다.

OWN-WORLD: 그 사람이 탈 막차의 노선색이 화면 전체를 칠한다(2호선 초록, 3호선 주황, 버스 파랑 등). 색에 생기는 단계는 노선색 위에 겹친다: 급함이면 아래 그늘이 붉게 짙어지고, 놓침이면 노선색이 빠져 거의 검정이 된다. 글자와 아이콘은 흰색 하나만 쓴다. 숫자는 좁고 키 큰 굵은 글꼴의 고정폭 숫자다. 오른쪽에는 가는 선 아이콘으로 된 버튼 레일이 있다. 왼쪽 아래 캡션은 그늘 위에 놓는다.

STORY: 열자마자 가장 급한 사람의 남은 시간이 화면 가득 보인다. 위로 넘기면 다음 사람 화면이 통째로 바뀐다. 오른쪽 레일로 그 사람을 고치거나, 경로를 펼치거나, 사람을 더하거나, 출발역을 바꾼다.

FIRST VIEWPORT: 맨 위 가운데에 "강남역에서 · 3명"(누르면 출발역 시트). 화면 세로 40% 지점에 남은 시간(약 120px 숫자)을 놓고, 그 아래에 한 줄 상태("남았어요"). 왼쪽 아래 캡션에는 이름 → 도착역, 출발 시각과 노선·행선지, 환승 구간 요약을 둔다. 오른쪽 아래 레일은 수정·경로·추가 세 개. 오른쪽 가장자리에 세로 페이지 점. 맨 아래에는 다음 사람의 노선색 띠가 살짝 보여서 넘길 수 있다는 걸 알린다.

FORM: 세로 피드 (pop-culture-shelf-vertical-video-feed-surface), 더 과감하게 다시 굴린 패에서 두 기준 모두 이긴 카드. seed:17f961a1f58eaf09

시그니처 움직임: 스크롤 스냅으로 사람을 넘긴다. 넘길 때 배경 노선색이 다음 사람 색으로 바뀌고, 숫자는 자리를 유지한 채 초만 바뀐다. 실시간으로 바뀐 막차는 확인할 때까지 강조 표시가 남는다.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
