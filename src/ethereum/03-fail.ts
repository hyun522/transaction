/**
 * [Ethereum 03] 일부러 실패시켜 보기 — ❌ 실패 케이스 모음
 *
 * 가이드 5-C 체크리스트를 코드로 옮긴 것입니다.
 * 핵심 질문은 항상 하나입니다: **"이 실패는 가스비를 먹었나?"**
 *
 *   유형 ① 접수 거부  → RPC 가 애초에 안 받아줌. 가스비 안 나감. tx hash 도 없음.
 *   유형 ③ 리버트     → 블록에는 들어감. 로직만 되돌려짐. **가스비는 나감.**
 *
 * 실행:
 *   npm run eth:03 nonce         # nonce 를 과거값으로 → "nonce too low"
 *   npm run eth:03 funds         # 잔액보다 큰 금액 → "insufficient funds"
 *   npm run eth:03 underpriced   # gas 를 1 wei 로 → "fee too low"
 *   npm run eth:03 revert        # 항상 revert 하는 컨트랙트 호출 → status 0
 */
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  formatGwei,
  http,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { ethereumRpcUrl, optional, required, title } from "../config.ts";

const CASES = ["nonce", "funds", "underpriced", "revert"] as const;
type Case = (typeof CASES)[number];

const picked = process.argv[2] as Case | undefined;
if (!picked || !CASES.includes(picked)) {
  console.error(`\n❌ 실패 케이스를 골라주세요.\n`);
  console.error(`   npm run eth:03 nonce         nonce 를 과거값으로`);
  console.error(`   npm run eth:03 funds         잔액보다 큰 금액`);
  console.error(`   npm run eth:03 underpriced   gas 를 1 wei 로`);
  console.error(`   npm run eth:03 revert        항상 실패하는 컨트랙트 호출\n`);
  process.exit(1);
}

const transport = http(ethereumRpcUrl());
const publicClient = createPublicClient({ chain: sepolia, transport });
const account = privateKeyToAccount(
  required("ETH_PRIVATE_KEY", "npm run eth:00 으로 지갑을 먼저 만드세요.") as `0x${string}`,
);
const walletClient = createWalletClient({ account, chain: sepolia, transport });
const to = (optional("ETH_RECIPIENT") ?? account.address) as `0x${string}`;

const before = await publicClient.getBalance({ address: account.address });
const nonce = await publicClient.getTransactionCount({ address: account.address });

/** 실패 후 잔액을 다시 재서 "가스비가 실제로 나갔는지"를 눈으로 확인한다. */
async function reportFeeImpact(expected: "안 나감" | "나감") {
  const after = await publicClient.getBalance({ address: account.address });
  const spent = before - after;
  console.log(`
  ── 가스비 정산 ──────────────────────────────
     이전 잔액 : ${formatEther(before)} ETH
     현재 잔액 : ${formatEther(after)} ETH
     차액      : ${formatEther(spent)} ETH
     예상      : 가스비 ${expected}  →  ${
       (spent === 0n) === (expected === "안 나감") ? "✅ 일치" : "⚠️ 예상과 다름"
     }`);
}

/** viem 이 던진 에러에서 사람이 읽을 부분만 뽑아 출력한다.
 *  viem 은 에러를 여러 겹으로 감싸므로(cause 체인) 끝까지 따라가야
 *  노드가 실제로 뭐라고 했는지("nonce too low" 등)가 나옵니다. */
function reportError(e: unknown) {
  const top = e as { name?: string; shortMessage?: string };
  console.log(`
  ❌ 거부됨 (tx hash 자체가 생기지 않았습니다)
     에러 종류 : ${top.name ?? "Error"}
     viem 요약 : ${top.shortMessage ?? String(e).split("\n")[0]}`);

  // cause 를 끝까지 따라가며 노드 원문을 찾는다.
  let cur: any = e;
  const seen: string[] = [];
  while (cur) {
    if (typeof cur.details === "string" && cur.details && !seen.includes(cur.details)) {
      seen.push(cur.details);
    }
    if (typeof cur.status === "number") seen.push(`HTTP ${cur.status}`);
    if (cur.body) seen.push(`요청 body: ${JSON.stringify(cur.body).slice(0, 120)}`);
    cur = cur.cause;
  }
  if (seen.length) {
    console.log(`     노드 원문 :`);
    for (const line of seen) console.log(`       · ${line}`);
  } else {
    console.log(`     노드 원문 : (RPC 가 본문 없이 HTTP 에러만 돌려줬습니다)`);
  }
}

// ─────────────────────────────────────────────────────────────
if (picked === "nonce") {
  title("❌ 케이스 1: nonce 를 과거값으로 (유형 ① 접수 거부)");

  if (nonce === 0) {
    console.error("\n  아직 보낸 tx 가 없어 nonce 가 0 입니다. npm run eth:02 를 먼저 실행하세요.\n");
    process.exit(1);
  }
  const stale = nonce - 1;
  console.log(`
  현재 정상 nonce : ${nonce}
  일부러 쓸 nonce : ${stale}  (이미 써버린 번호)

  💡 nonce 는 "내 계정의 거래 일련번호"입니다. ${stale}번은 이미 블록에 들어갔으므로
     같은 번호를 또 쓰면 노드가 중복으로 보고 즉시 거부합니다.`);

  try {
    const hash = await walletClient.sendTransaction({
      to,
      value: parseEther("0.00001"),
      nonce: stale,
    });
    console.log(`\n  ⚠️ 예상과 달리 접수되었습니다: ${hash}`);
  } catch (e) {
    reportError(e);
  }
  await reportFeeImpact("안 나감");
}

// ─────────────────────────────────────────────────────────────
if (picked === "funds") {
  title("❌ 케이스 2: 잔액보다 큰 금액 전송 (유형 ① 접수 거부)");

  const tooMuch = before * 10n;
  console.log(`
  현재 잔액  : ${formatEther(before)} ETH
  보낼 금액  : ${formatEther(tooMuch)} ETH  (잔액의 10배)

  💡 노드는 tx 를 받을 때 "이 사람이 금액 + 가스비를 감당할 수 있나"를 먼저 검사합니다.
     불가능하면 블록에 넣어보지도 않고 반려하므로 가스비가 나가지 않습니다.`);

  try {
    const hash = await walletClient.sendTransaction({ to, value: tooMuch });
    console.log(`\n  ⚠️ 예상과 달리 접수되었습니다: ${hash}`);
  } catch (e) {
    reportError(e);
  }
  await reportFeeImpact("안 나감");
}

// ─────────────────────────────────────────────────────────────
if (picked === "underpriced") {
  title("❌ 케이스 3: 가스비를 터무니없이 낮게 (유형 ①/② 거부 또는 영구 대기)");

  const block = await publicClient.getBlock();
  console.log(`
  현재 블록 base fee : ${formatGwei(block.baseFeePerGas ?? 0n)} gwei
  내가 제시할 최대가 : 0.000000001 gwei (= 1 wei)

  💡 EIP-1559 에서는 maxFeePerGas 가 base fee 보다 낮으면 블록에 들어갈 수 없습니다.
     노드가 즉시 거부하거나(①), 받아만 두고 영원히 대기시킵니다(②).`);

  try {
    const hash = await walletClient.sendTransaction({
      to,
      value: parseEther("0.00001"),
      maxFeePerGas: 1n,
      maxPriorityFeePerGas: 0n,
    });
    console.log(`
  ⚠️ 거부되지 않고 접수되었습니다 (유형 ② — 영구 pending):
     ${hash}
     https://sepolia.etherscan.io/tx/${hash}

  🚨 이 tx 가 nonce ${nonce} 번을 붙잡고 있어 다음 전송이 막힙니다.
     같은 nonce 에 높은 가스로 재전송하면 취소됩니다 (가이드 5-D "cancel"):

       npm run eth:03 revert   ← 이건 다른 케이스고,
       취소는 아래 한 줄을 별도로 실행하세요.`);
  } catch (e) {
    reportError(e);
  }
  await reportFeeImpact("안 나감");
}

// ─────────────────────────────────────────────────────────────
if (picked === "revert") {
  title("❌ 케이스 4: 리버트 — 블록엔 들어가지만 실패 (유형 ③ 가스비 나감!)");

  // 항상 revert 하는 최소 컨트랙트.
  //   배포부: 600580600b6000396000f3  → 뒤 5바이트를 런타임 코드로 반환
  //   런타임: 60006000fd              → PUSH1 0, PUSH1 0, REVERT (무조건 되돌림)
  const ALWAYS_REVERT = "0x600580600b6000396000f360006000fd" as const;

  console.log(`
  1단계: "무조건 실패하는" 초소형 컨트랙트를 배포합니다.
         런타임 코드는 단 5바이트: PUSH1 0 / PUSH1 0 / REVERT`);

  const deployHash = await walletClient.sendTransaction({ data: ALWAYS_REVERT });
  console.log(`     배포 tx : ${deployHash}`);
  const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  const contract = deployReceipt.contractAddress!;
  console.log(`     배포 완료 : ${contract}`);

  console.log(`
  2단계: 이 컨트랙트를 호출합니다. 반드시 리버트합니다.
         ⚠️ estimateGas 는 리버트를 미리 감지해 에러를 내므로, gas 를 직접 지정합니다.`);

  const beforeCall = await publicClient.getBalance({ address: account.address });
  const hash = await walletClient.sendTransaction({ to: contract, gas: 100_000n });
  console.log(`     호출 tx : ${hash}`);
  console.log(`     https://sepolia.etherscan.io/tx/${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const afterCall = await publicClient.getBalance({ address: account.address });
  const gasCost = receipt.gasUsed * receipt.effectiveGasPrice;

  console.log(`
  ✅ 블록 ${receipt.blockNumber} 에 "포함은 되었습니다"
     status   : ${receipt.status}  ${receipt.status === "reverted" ? "(= receipt status 0, 리버트)" : "(= 1, 성공?!)"}
     gasUsed  : ${receipt.gasUsed}  (지정한 100000 중 실제 소모분)
     가스비   : ${formatEther(gasCost)} ETH

  ── 가스비 정산 ──────────────────────────────
     호출 전 잔액 : ${formatEther(beforeCall)} ETH
     호출 후 잔액 : ${formatEther(afterCall)} ETH
     차액        : ${formatEther(beforeCall - afterCall)} ETH  ← 0 이 아닙니다!

  💡 이게 핵심입니다. 앞의 3개 케이스는 "접수 자체가 거부"되어 공짜였지만,
     리버트는 **노드가 실제로 실행해봤기 때문에** 그 계산 비용을 청구합니다.
     실패했는데 돈은 나가는 유일한 유형입니다.`);
}
