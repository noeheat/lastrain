// 운행 공지 → 모델 입력 문자열 (notice-parse.js·notice-eval.js 공용). 값이 없는 기간은 "없음"
export const toInput = (n) =>
  `제목: ${n.noftTtl}\n내용: ${n.noftCn}\n구분: ${n.noftSeCd}\n기간: ${n.xcseSitnBgngDt ?? '없음'} ~ ${n.xcseSitnEndDt ?? '없음'}`;
