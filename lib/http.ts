// API 응답 공용: 주소를 브라우저로 직접 열어도 한글이 깨지지 않게 charset을 명시한다
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
