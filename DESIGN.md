---
name: 막차 카운트다운
description: 같은 역에서 헤어지는 사람들 각자의 막차까지 남은 시간을, 그 사람이 탈 노선색 한 장으로 센다.
colors:
  field-ink: "#ffffff"
  urgent-shade: "#8f1020"
  field-missed: "#15171b"
  field-neutral: "#1b1e24"
  field-error: "#ffe1e1"
  night-floor: "#0b0d10"
  sheet-surface: "#16181d"
  sheet-ink: "#f4f5f7"
  sheet-muted: "#a3a8b3"
  hairline: "#2c3038"
  sheet-accent: "#9ecbff"
  sheet-error: "#ff8a8a"
typography:
  display:
    fontFamily: "Barlow Condensed, var(--font-num), sans-serif"
    fontSize: "min(36vw, 9rem)"
    fontWeight: 600
    lineHeight: 0.92
    letterSpacing: "-0.01em"
    fontFeature: "\"tnum\" 1"
  display-long:
    fontFamily: "Barlow Condensed, var(--font-num), sans-serif"
    fontSize: "min(28vw, 7.5rem)"
    fontWeight: 600
    lineHeight: 0.92
    letterSpacing: "-0.01em"
    fontFeature: "\"tnum\" 1"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Pretendard, Noto Sans KR, system-ui, sans-serif"
    fontSize: "1.45rem"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Pretendard, Noto Sans KR, system-ui, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 700
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Pretendard, Noto Sans KR, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.375
  status:
    fontFamily: "-apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Pretendard, Noto Sans KR, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 600
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Pretendard, Noto Sans KR, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
rounded:
  field: "10px"
  button: "12px"
  sheet: "20px"
  slide: "22px"
  pill: "9999px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "16px"
  gutter: "20px"
  lg: "24px"
components:
  rail-button:
    backgroundColor: "rgba(0,0,0,.15)"
    textColor: "{colors.field-ink}"
    rounded: "{rounded.pill}"
    size: "48px"
  rail-button-active:
    backgroundColor: "{colors.field-ink}"
    textColor: "{colors.night-floor}"
    rounded: "{rounded.pill}"
    size: "48px"
  line-badge:
    textColor: "{colors.field-ink}"
    rounded: "{rounded.pill}"
    height: "28px"
    padding: "0 6px"
  next-tag:
    backgroundColor: "rgba(0,0,0,.25)"
    textColor: "{colors.field-ink}"
    padding: "4px 8px"
  button-primary:
    backgroundColor: "{colors.field-ink}"
    textColor: "{colors.night-floor}"
    rounded: "{rounded.button}"
    height: "52px"
    width: "100%"
  button-danger-text:
    textColor: "{colors.sheet-error}"
    rounded: "{rounded.button}"
    height: "48px"
  input:
    backgroundColor: "{colors.night-floor}"
    textColor: "{colors.sheet-ink}"
    rounded: "{rounded.field}"
    padding: "12px"
    height: "48px"
  chip-choice:
    textColor: "{colors.sheet-ink}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "36px"
  chip-choice-selected:
    textColor: "{colors.sheet-accent}"
    rounded: "{rounded.pill}"
  sheet:
    backgroundColor: "{colors.sheet-surface}"
    textColor: "{colors.sheet-ink}"
    rounded: "{rounded.sheet}"
    padding: "12px 16px 20px"
---

# Design System: 막차 카운트다운

## Overview

**Creative North Star: "오늘 밤 탈 노선의 색"**

홈 화면은 한 사람이 한 장을 통째로 차지하는 세로 피드다. 그 장의 바탕은 그 사람이 처음 탈 막차의 공식 노선색(2호선 초록, 3호선 주황, 간선버스 파랑)이 칠하고, 그 위에 흰 글자 하나와 좁고 키 큰 숫자 하나가 올라간다. 위로 한 번 넘기면 다음 사람의 색으로 화면이 바뀐다. 장식은 없다. 색이 곧 "누구의, 어느 노선의" 막차인지를 말한다.

시간이 줄면 색이 상태를 겹쳐 말한다. 10분 안이면 아래에서 붉은 그늘이 차오르고, 막차가 떠나면 노선색이 빠져 거의 검정만 남는다. 편집 시트는 반대로 밤 바닥 위의 조용한 중립 다크 화면이다. 색은 홈의 몫이고, 시트는 입력에만 집중한다.

확인된 시각적 거부: 그라데이션, 유리(블러) 효과, 네온, 흔한 다크 대시보드 UI. 홈은 "가운데 큰 숫자 + 아래 칩 줄" 타이머 대시보드 배치를 쓰지 않는다.

**Key Characteristics:**
- 화면 전체가 노선색 한 장, 글자는 흰색 하나
- 남은 시간은 Barlow Condensed 600 고정폭 숫자, 화면 위 29% 지점에 고정
- 상태는 색으로 겹친다: 차오르는 붉은 그늘(급함), 빠진 색(놓침)
- 오른쪽 아래 원형 선 아이콘 레일, 왼쪽 아래 캡션
- 편집은 아래에서 올라오는 중립 다크 시트

## Colors

홈은 노선색이 주인이고, 나머지 색은 모두 그 위에 겹치거나(그늘·흰 글자) 시트의 밤 바닥을 이룬다.

### Primary
- **노선색 바탕 (Line Field)**: 고정 토큰이 아니라 사람마다 정해지는 값이다. `lib/lineColor.ts`의 공식 노선색(지하철 운영사 공식색, 서울 버스는 심야·광역·순환·지선·간선 다섯 색)을 `fieldColor()`가 흰 글자 대비 4.6:1이 나올 때까지만 밤 바닥 쪽으로 섞어 쓴다. 1호선·간선버스처럼 어두운 색은 그대로, 2호선·3호선·9호선·수인분당처럼 밝은 색은 필요한 만큼만 어두워진다. 노선을 모르면 **중립 바탕**(`field-neutral`)을 쓴다.
- **흰 잉크 (field-ink)**: 노선색 위의 모든 글자·아이콘·테두리. 시트의 주 버튼 바탕이기도 하다.

### Secondary
- **급함 그늘 (urgent-shade)**: 남은 시간 10분 이하일 때만 화면 아래에서 차오르는 짙은 붉은색 판. 단색 판이며 그라데이션이 아니다.
- **놓침 바탕 (field-missed)**: 막차가 떠난 사람의 장. 노선색을 빼고 남는 거의 검정.
- **노선색 위 오류 (field-error)**: 노선색 위에서 오류 문장을 쓸 때의 옅은 분홍(시트의 `sheet-error`는 색 바탕 위에서 대비가 안 나와 장 안에서 덮어쓴다).

### Neutral
- **밤 바닥 (night-floor)**: 앱 배경, 브라우저 theme-color 기본값, 시트 입력칸 바탕, 흰 주 버튼의 글자색.
- **시트 표면 (sheet-surface)**: 아래에서 올라오는 편집 시트의 판.
- **시트 잉크 (sheet-ink) / 시트 보조 (sheet-muted)**: 시트 본문과 라벨·힌트.
- **가는 선 (hairline)**: 시트의 입력칸·목록·핸들 테두리.
- **시트 강조 (sheet-accent)**: 시트 안에서만 쓰는 옅은 하늘색. 입력칸 포커스, 선택된 칩, "자동" 표시. 본문 흰색과 구분되는 유일한 강조.
- **시트 오류 (sheet-error)**: 시트 오류 문장, 잘못된 입력칸 테두리, "이 사람 삭제".

### Named Rules
**The Line Paints The Field Rule.** 홈의 한 장은 그 사람이 처음 탈 노선의 공식색으로 칠한다. 색을 새로 고르지 않는다. 노선색은 항상 `lineColor()` → `fieldColor()`를 거친다.

**The Contrast Floor Rule.** 노선색 바탕은 흰 글자 대비 4.6:1 아래로 내려가지 않는다. 밝은 노선은 밤 바닥 쪽으로 섞어 대비를 맞추고, 어두운 노선은 손대지 않는다.

**The One Ink Rule.** 노선색 위의 글자는 흰색 하나다. 보조 글자는 회색이 아니라 흰색의 투명도(85~90%)로 덜어 쓴다. 장 안에서는 `--muted`를 `rgba(255,255,255,.85)`로 덮어써서 하위 컴포넌트도 이 규칙을 따른다.

**The Sheet Is Night Rule.** 시트는 노선색을 쓰지 않는 중립 다크다. `sheet-accent`는 시트 안에서만 쓴다.

## Typography

**Display Font:** Barlow Condensed 600 (`next/font`로 빌드 때 받아 `--font-num`으로 서빙)
**Body Font:** 시스템 한글 스택 (-apple-system, Apple SD Gothic Neo, Pretendard, Noto Sans KR, system-ui)

**Character:** 숫자만 좁고 키 큰 굵은 고정폭 글꼴로 따로 세우고, 나머지 한국어는 기기 기본 고딕이 담담하게 받친다. 한국어는 낱말 중간에서 줄바꿈하지 않는다(`word-break: keep-all`).

### Hierarchy
- **Display** (600, `min(36vw, 9rem)`, 0.92): 남은 시간 `MM:SS`·`HH:MM` 5자. 고정폭 숫자.
- **Display Long** (600, `min(28vw, 7.5rem)`, 0.92): 1시간 넘게 남은 `H:MM:SS` 7자. 한 줄에 들어가게 글자 크기만 줄인다.
- **Headline** (700, 1.45rem, 1.25): 빈 상태의 질문 한 줄("어디서 헤어지나요?").
- **Title** (700, 1.15rem): 캡션의 "이름 → 도착역". 시트 제목은 600, 1.1rem.
- **Status** (600, 0.95rem): 숫자 바로 아래 한 줄 상태("남았어요 · 이제 역으로"), 위쪽 출발역 버튼.
- **Body** (400, 0.92~0.95rem, snug): 캡션의 출발 시각·노선·행선지 문장, 빈 상태 설명.
- **Label** (600, 0.75~0.85rem): 레일 버튼 이름, 다음 사람 태그(0.78rem), 시트 라벨·힌트(0.85rem, 400).

### Named Rules
**The Numeral Holds Rule.** 남은 시간은 항상 고정폭 숫자(`tabular-nums`)라서 초가 바뀌어도 자리가 흔들리지 않는다. 숫자 블록은 장의 위 29% 지점에 고정한다.

**The One Display Voice Rule.** Barlow Condensed는 숫자(남은 시간, 빈 상태의 `--:--`)에만 쓴다. 한국어 문장에는 쓰지 않는다.

## Layout

홈은 세로 스크롤 스냅(`snap-y mandatory`) 피드다. 한 장의 높이는 화면 전체(`100dvh`)다. 다음 장을 아래에 살짝 보이게 하던 방식은 주소창이 아래에 있는 안드로이드 브라우저에서 화면이 잘린 것처럼 보여 없앴다(2026-11-12). 넘길 수 있다는 표시는 오른쪽 페이지 점과 캡션의 다음 사람 태그가 맡는다. 넘길 때는 **카드가 겹쳐 올라온다**: 앞 사람 카드는 제자리에 머물며(스크롤만큼 내려 상쇄) 3% 작아지고 최대 35% 어두워지고, 다음 사람 카드가 둥근 위 모서리(`rounded.slide`)로 그 위를 덮는다. 사람 사이 구분은 둥근 모서리와 어두워진 앞 카드가, 이어지는 느낌은 앞 카드가 날아가지 않고 머무는 것이 맡는다(2026-11-12). 덮인 정도는 스크롤 처리에서 장마다 `--cover`(0~1)로 쓰고 `globals.css`의 `.feed-card`·`.feed-dim`이 그린다. 동작 줄이기 설정이면 평범한 스크롤로 돌아간다. 넓은 화면에서도 가운데 520px 한 줄로 휴대폰 폭을 유지한다(바깥은 밤 바닥).

한 장의 자리는 고정이다.
- 위 가운데: 출발역 버튼("강남역에서 · 3명"), 위 safe-area 아래 최소 14px.
- 위 29%: 숫자와 상태 줄(좌우 `gutter` 20px).
- 왼쪽 아래: 캡션. 왼쪽 20px, 오른쪽은 레일 자리 84px를 비운다. 아래 24px(마지막 장은 safe-area + 28px).
- 오른쪽 아래: 레일. 오른쪽 12px, 버튼 사이 16px.
- 오른쪽 가장자리 가운데: 세로 페이지 점(사람이 2명 이상일 때).

시트는 화면 아래에 붙고 최대 높이 85dvh, 좌우 16px, `sm` 이상에서는 가운데 480px. 시트 안 리듬은 라벨 아래 6px, 칸 사이 12px.

**The Fixed Seat Rule.** 상태가 바뀌어도(급함, 놓침, 다시 확인, 빈 상태) 숫자·캡션·레일의 자리는 그대로다. 빈 상태도 숫자 자리에 흐린 `--:--`를 두고 할 일은 레일 버튼 하나로 둔다.

## Elevation & Depth

그림자를 쓰지 않는 평면 시스템이다. 깊이는 장이 장 위에 겹치는 것(넘길 때 다음 장이 둥근 위 모서리로 어두워진 앞 장을 덮는다), 노선색 위에 얹는 반투명 검정(레일 버튼 15%, 다음 사람 태그 25%), 시트 뒤 배경을 60% 검정으로 덮는 것으로 만든다. 유일한 그림자는 출발역 버튼 글자의 은은한 `text-shadow: 0 1px 8px rgba(0,0,0,.25)`로, 밝은 노선색 위 가독성 보조다. 블러(유리 효과)는 쓰지 않는다.

**The Layered Not Lifted Rule.** 요소는 떠오르지 않고 겹친다. 반투명 검정·흰 테두리로 구분하고, box-shadow로 띄우지 않는다.

## Shapes

둥근 모서리와 완전한 원이 섞인 부드러운 형태다. 손가락이 닿는 것(레일 버튼, 노선 원, 칩, 페이지 점)은 원·알약, 판은 큰 반경(장 22px, 시트 20px), 입력칸은 10px, 시트의 큰 버튼은 12px. 노선색 위 테두리는 흰색 1.5~2px, 시트 테두리는 1px `hairline`.

아이콘은 직접 그린 SVG 선 아이콘이며 선 굵기 1.75 하나, 둥근 끝·둥근 이음, 24 그리드에 26px로 그린다(펼침 표시만 16px).

## Components

### Buttons
- **레일 버튼 (rail-button):** 지름 48px 원, 흰 1.5px 테두리, 15% 검정 바탕, 가운데 선 아이콘, 아래 0.75rem 600 이름. 호버는 바탕이 흰색 15%, 누르면 0.95로 줄어든다(200ms).
- **레일 버튼 강조 (rail-button-active):** 흰 바탕에 밤 바닥색 아이콘. 눌린 토글(경로 펼침)과 지금 해야 할 일(다시 확인, 빈 상태의 출발역·추가)에 쓴다.
- **주 버튼 (button-primary):** 시트 맨 아래 "저장". 흰 바탕, 밤 바닥색 1.05rem 700 글자, 높이 52px, 폭 100%.
- **위험 글자 버튼 (button-danger-text):** "이 사람 삭제". 바탕 없이 `sheet-error` 글자.

### Chips
- **막차 선택 칩 (chip-choice):** 높이 36px 알약, 1px `hairline` 테두리, 0.85rem. 선택되면 테두리와 글자가 `sheet-accent`로 바뀐다.
- **노선 알약 (StationPicker):** 고른 도착역 라벨 옆 작은 알약. 바탕은 `fieldColor(lineColor())`, 흰 0.78rem 600 글자. 시트 안에서 노선색이 나오는 유일한 자리다.
- **실시간 앞당김 표시:** 상태 줄 아래 흰 테두리 알약, 0.8rem 600. 버스 실시간이 막차를 앞당겼을 때만.

### Inputs / Fields
- **Style:** 밤 바닥 바탕, 1px `hairline` 테두리, 10px 반경, 최소 높이 48px, 1.05rem 글자, 흰 커서.
- **Focus:** `sheet-accent` 2px 외곽선(1px 띄움). 앱 전체 `:focus-visible`은 흰 2px 외곽선(3px 띄움).
- **Error:** 테두리가 `sheet-error`.
- **막차 칸 (LastTrainField):** 최소 높이 76px, 시각은 1.6rem 700 고정폭 숫자, 오른쪽에 "자동"(accent 15% 바탕) 또는 "직접 지정" 알약.

### Navigation
- **출발역 버튼:** 위 가운데 "강남역에서 · 3명 ⌄"(⌄는 선 아이콘). 역 이름 600, 인원 400 흰 80%. 누르면 출발역 시트.
- **페이지 점:** 오른쪽 가장자리 세로 막대 4px 폭. 지금 사람은 24px 흰색, 나머지는 12px 흰 40%. 누르면 그 사람으로 스크롤(줄인 동작 설정이면 즉시).

### 한 사람 장 (Signature Component)
노선색 한 장에 숫자·상태 줄, 캡션, 레일이 고정 자리에 놓인다. 캡션 첫 줄은 **노선 원**(28px 원, 흰 2px 테두리, 바탕은 노선색 바탕과 같은 `fieldColor()` 값이라 흰 글자 대비 4.6:1을 지킨다, 노선 번호나 짧은 이름) + "이름 → 도착역", 둘째 줄은 "강남에서 23:31에 떠나는 2호선 성수행 막차", 환승이면 셋째 줄에 구간 요약. 맨 아래 **다음 사람 태그**(25% 검정, 6px 반경, "다음 · 민호 46:56")가 다음 장을 미리 알린다. 처음 열면 가장 급한 사람 장에서 시작하고, 사람 순서는 바꾸지 않는다. 모든 카드(첫 카드 포함)는 위 모서리가 둥글어 카드 묶음으로 읽히고, 상태 표시줄(theme-color)은 밤 바닥색으로 고정해 둥근 모서리 바깥과 이어진다(2026-11-12).

상태별 처리:
- **여유/주의:** 노선색 그대로. 상태 줄 문구만 바뀐다.
- **급함(10분 이하):** `urgent-shade` 판이 아래에서 30%에서 45%까지 남은 시간에 비례해 차오른다(1000ms linear). 숫자·상태 줄에는 닿지 않는다.
- **놓침:** 바탕이 `field-missed`, 숫자는 떠난 시각을 흰 45%로 쓰고 0.06em 줄을 긋는다.
- **다시 확인(출발역 바뀜):** 노선색은 유지, 숫자는 흰 45% `--:--`, 수정 버튼이 강조 레일 버튼 "다시 확인"이 된다.

### 시트 (Sheet)
브라우저 `<dialog>`로 아래에서 올라온다. `sheet-surface` 판, 위 모서리 20px, 1px `hairline` 테두리(아래 없음), 위에 40×4px 핸들, 제목 1.1rem 600과 오른쪽 "닫기" 글자 버튼. 뒤 화면은 60% 검정으로 덮는다.

## Do's and Don'ts

### Do:
- **Do** 홈의 장 바탕은 언제나 `fieldColor(lineColor(첫 구간))`로 칠한다. 노선을 모르면 `field-neutral`.
- **Do** 노선색 위 보조 글자는 흰색 투명도(80~90%)로 쓴다.
- **Do** 남은 시간은 Barlow Condensed 600 고정폭 숫자로, 장 위 29% 자리에 둔다.
- **Do** 상태는 색을 겹쳐 말한다: 급함은 아래에서 차오르는 `urgent-shade` 단색 판, 놓침은 `field-missed`와 줄 그은 흐린 숫자.
- **Do** 새 아이콘은 선 굵기 1.75, 둥근 끝, 24 그리드 SVG로 직접 그린다.
- **Do** 움직임은 `prefers-reduced-motion`이면 즉시 이동으로 바꾼다.

### Don't:
- **Don't** 그라데이션, 유리(블러) 효과, 네온 발광을 쓰지 않는다.
- **Don't** 노선색 위에 회색 글자나 흰색 아닌 강조색을 쓰지 않는다.
- **Don't** 공식 노선색을 대비 보정 없이 넓은 바탕에 깔지 않는다(4.6:1 미만).
- **Don't** box-shadow로 요소를 띄우지 않는다.
- **Don't** `sheet-accent` 하늘색을 홈의 노선색 장 위에 쓰지 않는다.
