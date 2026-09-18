/**
 * 환경변수를 읽고, 없으면 "무엇을 어떻게 채워야 하는지" 알려주는 헬퍼.
 *
 * 실행 시 .env 를 읽히려면 반드시 --env-file 플래그가 필요합니다.
 *   node --env-file=.env node_modules/.bin/tsx src/...
 * package.json 의 npm 스크립트가 이미 그렇게 되어 있습니다.
 */

// ── RPC 요청 속도 제한 ────────────────────────────────────────────
// 무료 티어 RPC(Tatum / Helius)는 초당 허용 요청 수가 적습니다. 그런데 viem 은
// 트랜잭션 하나를 보낼 때 chainId·nonce·gas·baseFee 조회를 순식간에 연달아 쏩니다.
// 그대로 두면 정작 중요한 eth_sendRawTransaction 이 HTTP 429 로 튕기고,
// 그러면 "nonce 때문에 실패했는지, 한도 때문에 실패했는지" 구분이 안 됩니다.
//
// 그래서 전역 fetch 를 감싸 (1) 요청을 한 줄로 세우고 (2) 최소 간격을 두고
// (3) 429 면 점점 더 기다렸다 재시도합니다.
const MIN_INTERVAL_MS = 350;
const MAX_RETRY = 4;

const nativeFetch = globalThis.fetch.bind(globalThis);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

globalThis.fetch = ((input: any, init: any) => {
  const task = queue.then(async () => {
    for (let attempt = 0; ; attempt++) {
      const gap = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
      if (gap > 0) await wait(gap);
      lastRequestAt = Date.now();

      const res = await nativeFetch(input, init);
      if (res.status !== 429) {
        logRpc(init, res, attempt);
        return res;
      }
      if (attempt >= MAX_RETRY) {
        console.warn(`  ⚠️ RPC 요청 한도(429)로 ${MAX_RETRY}회 재시도했지만 실패했습니다.`);
        return res;
      }
      await wait(600 * (attempt + 1));
    }
  });
  // 성공/실패와 무관하게 다음 요청이 이어지도록 큐를 유지한다.
  queue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}) as typeof globalThis.fetch;

/** DEBUG_RPC=1 일 때, 실제로 오간 JSON-RPC 요청/응답을 한 줄씩 찍는다.
 *  "viem 의 함수 1개 = RPC 몇 개"인지 눈으로 보려고 만든 디버그용 도구입니다. */
let rpcSeq = 0;
function logRpc(init: any, res: Response, attempt: number) {
  if (process.env.DEBUG_RPC !== "1") return;
  try {
    const req = JSON.parse(init?.body ?? "{}");
    const calls = Array.isArray(req) ? req : [req];
    for (const c of calls) {
      const params = JSON.stringify(c.params ?? []).slice(0, 70);
      console.log(
        `  [rpc ${String(++rpcSeq).padStart(2)}] ${String(c.method).padEnd(26)} ${params}` +
          (attempt > 0 ? `  (429 재시도 ${attempt}회)` : ""),
      );
    }
  } catch {
    /* 본문이 JSON 이 아니면 조용히 넘어간다 */
  }
}

/** 값이 반드시 있어야 하는 환경변수. 없으면 친절한 안내와 함께 종료. */
export function required(name: string, hint: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    console.error(`\n❌ .env 에 ${name} 가 비어 있습니다.`);
    console.error(`   → ${hint}\n`);
    process.exit(1);
  }
  return value.trim();
}

/** 있으면 쓰고 없으면 undefined 인 선택적 환경변수. */
export function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : undefined;
}

/** Helius devnet RPC URL 을 조립한다. */
export function solanaRpcUrl(): string {
  const key = required(
    'HELIUS_API_KEY',
    'https://helius.dev 에 가입해 무료 API 키를 발급받아 넣으세요.',
  );
  return `https://devnet.helius-rpc.com/?api-key=${key}`;
}

/** Tatum Sepolia RPC URL 을 조립한다. */
export function ethereumRpcUrl(): string {
  const key = required(
    'TATUM_API_KEY',
    'https://tatum.io 에 가입해 무료 API 키를 발급받아 넣으세요.',
  );
  return `https://ethereum-sepolia.gateway.tatum.io/${key}`;
}

/** 콘솔에 구분선 있는 제목을 찍는다. 실습 로그를 읽기 쉽게 하기 위함. */
export function title(text: string): void {
  console.log(`\n${'─'.repeat(60)}\n${text}\n${'─'.repeat(60)}`);
}
