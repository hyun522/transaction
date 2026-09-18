/**
 * [Ethereum 02] 실제 전송 — ✅ 성공 케이스
 *
 * 가이드 5-B 체크리스트 전체를 코드로 옮긴 것입니다.
 *   eth_getTransactionCount  → nonce 확인
 *   eth_gasPrice / estimateGas → 가스 정보
 *   (로컬 서명)              → raw transaction 생성
 *   eth_sendRawTransaction   → Tatum 에 던지기
 *   eth_getTransactionReceipt → 결과 확인
 *
 * 핵심 포인트 — 서명과 전송을 "일부러 두 줄로 분리"했습니다.
 * viem 의 sendTransaction() 을 쓰면 한 줄로 끝나지만, 그러면
 * "어디까지가 내 컴퓨터 일이고 어디부터 RPC 일인지"가 안 보입니다.
 *
 * 실행:  npm run eth:02
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

// 보낼 금액. 작게 잡아야 여러 번 실습할 수 있습니다.
const AMOUNT = "0.00001";

title("Ethereum Sepolia 전송 (성공 케이스)");

const transport = http(ethereumRpcUrl());
const publicClient = createPublicClient({ chain: sepolia, transport });

const privateKey = required(
  "ETH_PRIVATE_KEY",
  "npm run eth:00 으로 지갑을 만든 뒤 출력된 개인키를 넣으세요.",
) as `0x${string}`;
const account = privateKeyToAccount(privateKey);

// walletClient 는 "서명할 수 있는" 클라이언트. publicClient 는 읽기 전용.
const walletClient = createWalletClient({ account, chain: sepolia, transport });

// 받는 주소가 없으면 자기 자신에게 보낸다. 실습용으로는 이게 가장 안전합니다.
const to = (optional("ETH_RECIPIENT") ?? account.address) as `0x${string}`;

// ── 1단계: 보내기 전 상태 기록 (나중에 비교하려고) ────────────────
const before = await publicClient.getBalance({ address: account.address });
const nonce = await publicClient.getTransactionCount({
  address: account.address,
});
const gasPrice = await publicClient.getGasPrice();

console.log(`  보내는 주소 : ${account.address}`);
console.log(
  `  받는 주소   : ${to}${to === account.address ? "  (자기 자신)" : ""}`,
);
console.log(`  보낼 금액   : ${AMOUNT} ETH`);
console.log(`
  전송 전 잔액 : ${formatEther(before)} ETH
  사용할 nonce : ${nonce}
  현재 gas     : ${formatGwei(gasPrice)} gwei`);

if (before === 0n) {
  console.error(
    "\n❌ 잔액이 0입니다. faucet 으로 Sepolia ETH 를 먼저 받으세요.",
  );
  process.exit(1);
}

// ── 2단계: 트랜잭션 조립 ────────────────────────────────────────
// prepare 가 nonce·gas·chainId 등 빠진 항목을 RPC 에 물어서 채워줍니다.
const request = await walletClient.prepareTransactionRequest({
  to,
  value: parseEther(AMOUNT),
});
console.log(`\n  ⛽ 예상 gas limit : ${request.gas}`);

// ── 3단계: 로컬에서 서명 (네트워크 접속 없음) ──────────────────────
// 조깁된내용에 + 개인키를 더해 나만의 도장을 만들어서 보내겠다
// 여기가 개인키가 쓰이는 유일한 지점입니다. Tatum 은 개인키를 절대 못 봅니다.
const serialized = await walletClient.signTransaction(request);
console.log(
  `  ✍️  서명 완료 (raw tx ${serialized.length}자): ${serialized.slice(0, 40)}...`,
);

// ── 4단계: 서명된 결과만 RPC 에 전달 ──────────────────────────────
// 나 이거래 할거야 내도장 줄께 rpc 그럼 rpc 에서 그래 거래해라 hash 해당 트랜잭션의 고유 Id 던짐 접수 Id같은거지
const hash = await publicClient.sendRawTransaction({
  serializedTransaction: serialized,
});
console.log(`\n  📮 전송됨. tx hash = ${hash}`);
console.log(`     https://sepolia.etherscan.io/tx/${hash}`);

// ── 5단계: 블록에 포함될 때까지 기다린 뒤 영수증 확인 ────────────────
console.log(`\n  ⏳ 블록에 포함되기를 기다리는 중... (보통 12~15초)`);
const receipt = await publicClient.waitForTransactionReceipt({ hash });

const gasCost = receipt.gasUsed * receipt.effectiveGasPrice;
const after = await publicClient.getBalance({ address: account.address });

console.log(`
  ✅ 블록 ${receipt.blockNumber} 에 포함됨
     status      : ${receipt.status}  ${receipt.status === "success" ? "(= receipt status 1, 성공)" : "(= receipt status 0, 리버트)"}
     gasUsed     : ${receipt.gasUsed}  (단순 송금은 항상 21000)
     실제 가스비 : ${formatEther(gasCost)} ETH

  전송 후 잔액 : ${formatEther(after)} ETH
  줄어든 양    : ${formatEther(before - after)} ETH`);

if (to === account.address) {
  console.log(`
  💡 자기 자신에게 보냈으므로 ${AMOUNT} ETH 는 그대로 돌아왔고,
     줄어든 ${formatEther(before - after)} ETH 는 전부 가스비입니다.`);
}

console.log(`
  다음 단계: npm run eth:01 로 nonce 가 ${nonce} → ${nonce + 1} 로 올라갔는지 확인해보세요.`);
