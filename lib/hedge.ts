// 헤지 요청 (DOM 없음, 테스트 공용): 첫 시도가 delayMs 안에 끝나지 않으면 같은 요청을 한 번 더 보내 먼저 성공한 쪽을 쓴다
// TAGO는 대부분 3초 안에 답하지만, 가끔 한 요청만 응답 없이 멈춘다. 끝까지 기다리는 것보다 하나 더 보내는 게 빠르다

/** 두 시도가 모두 실패하면 마지막 오류를 던진다. 첫 시도가 일찍 실패하면 delayMs를 기다리지 않고 바로 다시 보낸다 */
export function hedge<T>(run: (attempt: number) => Promise<T>, delayMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let started = 0;
    let failed = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const start = () => {
      const attempt = ++started;
      run(attempt).then(
        (v) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          if (settled) return;
          failed++;
          if (started < 2) {
            clearTimeout(timer);
            start();
          } else if (failed === 2) {
            settled = true;
            reject(e);
          }
        },
      );
    };

    start();
    timer = setTimeout(() => { if (!settled && started < 2) start(); }, delayMs);
  });
}
