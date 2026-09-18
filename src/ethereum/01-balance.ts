/**
 * [Ethereum 01] 잔액 + 체인 정보 조회 — 쓰기 전에 읽기부터
 *
 * 가이드 5-A/5-B 체크리스트 준비 단계.
 *
 * 핵심 포인트 — viem 의 함수 이름이 RPC 메서드와 1:1 로 대응합니다.
 *   getBalance()            → eth_getBalance
 *   getTransactionCount()   → eth_getTransactionCount   (= nonce)
 *   getGasPrice()           → eth_gasPrice
 * 가이드 5번 섹션 체크리스트를 그대로 코드로 읽을 수 있습니다.
 *
 * 실행:  npm run eth:01
 */
import { createPublicClient, formatEther, formatGwei, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { ethereumRpcUrl, optional, required, title } from "../config.ts";

title("Ethereum Sepolia 잔액 조회");

const client = createPublicClient({
  chain: sepolia,
  transport: http(ethereumRpcUrl()),
});

const privateKey = required(
  "ETH_PRIVATE_KEY",
  "npm run eth:00 으로 지갑을 만든 뒤 출력된 개인키를 넣으세요.",
) as `0x${string}`;
const account = privateKeyToAccount(privateKey);

console.log(`  RPC     : ethereum-sepolia.gateway.tatum.io (키는 가림)`);
console.log(`  내 주소 : ${account.address}`);

// wei 가 최소 단위. 1 ETH = 10^18 wei, 1 gwei = 10^9 wei.
const balance = await client.getBalance({ address: account.address });
// nonce = 이 계정이 지금까지 보낸 트랜잭션 개수 = 다음에 쓸 번호표.
const nonce = await client.getTransactionCount({ address: account.address });
const gasPrice = await client.getGasPrice();
const blockNumber = await client.getBlockNumber();

console.log(`
  잔액        : ${formatEther(balance)} ETH  (${balance} wei)
  다음 nonce  : ${nonce}
  현재 gas    : ${formatGwei(gasPrice)} gwei
  최신 블록   : ${blockNumber}
`);

if (balance === 0n) {
  console.log(`⚠️  잔액이 0입니다. faucet 에서 Sepolia ETH 를 받으세요.
    https://www.alchemy.com/faucets/ethereum-sepolia  →  ${account.address}`);
} else {
  console.log(`✅ 전송 실습을 시작할 수 있습니다. → npm run eth:02`);
}

console.log(`
🔎 Etherscan 에서 같은 정보를 눈으로 확인해보세요 (RPC 와 탐색기의 차이 체감):
   https://sepolia.etherscan.io/address/${account.address}`);

const recipient = optional("ETH_RECIPIENT");
if (recipient) {
  const toBalance = await client.getBalance({
    address: recipient as `0x${string}`,
  });
  console.log(`\n  받는 주소 ${recipient}`);
  console.log(`  잔액      : ${formatEther(toBalance)} ETH`);
}
