/**
 * [Ethereum 04] 대체 & 취소 — 🔄 "롤백"의 현실적인 방법
 *
 * 가이드 5-D 를 코드로 옮긴 것입니다.
 *
 * 이더리움에는 "보낸 tx 를 되돌리는" 기능이 없습니다.
 * 대신 **아직 블록에 안 들어간(pending) tx 를 같은 nonce 로 덮어쓰는** 방법만 있습니다.
 * 지갑 UI 의 "speed up / cancel" 버튼이 실제로 하는 일이 정확히 이것입니다.
 *
 *   핵심 규칙: nonce 는 계정당 한 번만 유효하다.
 *              → 같은 nonce 의 tx 가 둘이면, 먼저 블록에 들어간 쪽만 살아남는다.
 *
 * 실행:
 *   npm run eth:04 cancel    # 원래 tx 를 "0 ETH 자기송금" 으로 무력화
 *   npm run eth:04 speedup   # 원래 tx 를 같은 내용 + 높은 가스로 재전송
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

const MODES = ["cancel", "speedup"] as const;
type Mode = (typeof MODES)[number];

const mode = process.argv[2] as Mode | undefined;
if (!mode || !MODES.includes(mode)) {
  console.error(`\n❌ 모드를 골라주세요.\n`);
  console.error(`   npm run eth:04 cancel     원래 tx 를 취소 (0 ETH 자기송금으로 덮어쓰기)`);
  console.error(`   npm run eth:04 speedup    원래 tx 를 같은 내용 + 높은 가스로 재전송\n`);
  process.exit(1);
}

const AMOUNT = "0.00001";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const transport = http(ethereumRpcUrl());
const publicClient = createPublicClient({ chain: sepolia, transport });
const account = privateKeyToAccount(
  required("ETH_PRIVATE_KEY", "npm run eth:00 으로 지갑을 먼저 만드세요.") as `0x${string}`,
);
const walletClient = createWalletClient({ account, chain: sepolia, transport });
const to = (optional("ETH_RECIPIENT") ?? account.address) as `0x${string}`;

title(mode === "cancel" ? "🔄 pending tx 취소 (cancel)" : "🔄 pending tx 가속 (speed up)");

const before = await publicClient.getBalance({ address: account.address });
const nonce = await publicClient.getTransactionCount({ address: account.address });
const block = await publicClient.getBlock();
const baseFee = block.baseFeePerGas ?? 1_000_000_000n;

// ── 1단계: 일부러 "느린" tx 를 만든다 ───────────────────────────────
// priority fee 를 0 으로 두면 검증자에게 돌아가는 팁이 없어 뒤로 밀립니다.
// maxFee 는 base fee 를 겨우 넘기게 잡아 거부는 피하고 대기만 하도록 유도합니다.
const slowMaxFee = (baseFee * 101n) / 100n;

console.log(`
  현재 base fee : ${formatGwei(baseFee)} gwei
  느린 tx 설정  : maxFee ${formatGwei(slowMaxFee)} gwei / priority 0 gwei
  사용할 nonce  : ${nonce}

  1단계: 팁 0 짜리 tx 를 보내 일부러 대기열에 머물게 합니다.`);

const slowHash = await walletClient.sendTransaction({
  to,
  value: parseEther(AMOUNT),
  nonce,
  maxFeePerGas: slowMaxFee,
  maxPriorityFeePerGas: 0n,
});
console.log(`     원래 tx : ${slowHash}`);
console.log(`     https://sepolia.etherscan.io/tx/${slowHash}`);

// ── 2단계: 아직 pending 인지 확인 ──────────────────────────────────
// 이미 블록에 들어갔다면 대체는 원천적으로 불가능합니다. 그게 이 실습의 교훈 절반입니다.
console.log(`\n  2단계: pending 상태인지 확인 중... (3초 대기)`);
await sleep(3000);

const slowTx = await publicClient.getTransaction({ hash: slowHash }).catch(() => null);
if (slowTx?.blockNumber != null) {
  console.log(`
  ⚠️ 이미 블록 ${slowTx.blockNumber} 에 포함되어 버렸습니다.

  💡 이것도 중요한 결과입니다. **블록에 들어간 tx 는 절대 대체·취소할 수 없습니다.**
     Sepolia 는 한산해서 팁이 0 이어도 바로 채택되는 경우가 많습니다.
     메인넷처럼 혼잡한 망에서만 "pending 에 머무는 구간"이 길게 생깁니다.

     다시 시도하려면 그냥 한 번 더 실행해보세요.`);
  process.exit(0);
}
console.log(`     ✅ 아직 pending 입니다. 대체할 수 있습니다.`);

// ── 3단계: 같은 nonce 에 더 높은 가스로 덮어쓴다 ──────────────────────
// EIP-1559 규칙상 maxFee 와 priority fee 를 **둘 다** 최소 10% 올려야 노드가 교체를 받아줍니다.
// 여유 있게 3배로 잡습니다.
const fastMaxFee = slowMaxFee * 3n;
const fastTip = baseFee; // 팁을 base fee 만큼 얹어 확실히 우선 채택되게

console.log(`
  3단계: 같은 nonce ${nonce} 에 더 높은 가스로 재전송합니다.
         maxFee ${formatGwei(fastMaxFee)} gwei / priority ${formatGwei(fastTip)} gwei
         ${
           mode === "cancel"
             ? "내용: 0 ETH 를 나 자신에게  ← 아무 일도 안 하는 tx 로 덮어쓰기 = 취소"
             : `내용: 원래와 동일 (${AMOUNT} ETH → ${to})  ← 내용은 그대로, 속도만 올리기`
         }`);

const replaceHash = await walletClient.sendTransaction({
  to: mode === "cancel" ? account.address : to,
  value: mode === "cancel" ? 0n : parseEther(AMOUNT),
  nonce, // ← 같은 번호. 이게 대체의 전부입니다.
  maxFeePerGas: fastMaxFee,
  maxPriorityFeePerGas: fastTip,
});
console.log(`     대체 tx : ${replaceHash}`);
console.log(`     https://sepolia.etherscan.io/tx/${replaceHash}`);

// ── 4단계: 어느 쪽이 살아남았는지 확인 ──────────────────────────────
console.log(`\n  4단계: 블록에 포함되기를 기다리는 중...`);
const receipt = await publicClient.waitForTransactionReceipt({ hash: replaceHash });

const survivor = await publicClient.getTransaction({ hash: slowHash }).catch(() => null);
const after = await publicClient.getBalance({ address: account.address });
const gasCost = receipt.gasUsed * receipt.effectiveGasPrice;

console.log(`
  ── 결과 ─────────────────────────────────────
     대체 tx  : 블록 ${receipt.blockNumber} 에 포함 ✅ (status ${receipt.status})
     원래 tx  : ${survivor == null ? "사라짐 ✅ (노드가 폐기)" : `아직 조회됨 ⚠️ (block ${survivor.blockNumber ?? "pending"})`}

     소모 가스비 : ${formatEther(gasCost)} ETH
     잔액 변화   : ${formatEther(before)} → ${formatEther(after)} ETH
                   (차액 ${formatEther(before - after)} ETH)

  💡 정리
     · 취소한 tx 는 **없던 일이 되지만, 대체 tx 의 가스비는 나갑니다.** 공짜가 아닙니다.
     · nonce ${nonce} 는 결국 한 번만 소비되었습니다. 지금 nonce 는 ${nonce + 1} 입니다.
     · 블록에 이미 들어간 tx 에는 이 방법이 통하지 않습니다 — 그게 "롤백이 없다"는 말의 의미입니다.
     · 진짜 롤백(reorg)은 네트워크가 포크를 갈아탈 때만 일어나며, 내가 일으킬 수 없습니다.`);
