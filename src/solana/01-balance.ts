/**
 * [Solana 01] 잔액 조회 — 쓰기 전에 읽기부터
 *
 * 가이드 4-A 체크리스트: "devnet SOL faucet 으로 잔액 확보" 확인용
 *
 * 핵심 포인트 — 여기서 처음으로 Helius(RPC 창구)에 말을 겁니다.
 * 하지만 '읽기' 요청이라 서명이 필요 없습니다. 은행 창구에서 잔액 조회만 하는 것과 같습니다.
 *
 * 실행:  npm run sol:01
 */
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { optional, required, solanaRpcUrl, title } from '../config.ts';

title('Solana devnet 잔액 조회');

const connection = new Connection(solanaRpcUrl(), 'confirmed');

// 비밀키에서 주소를 복원한다. (비밀키 → 공개키는 가능, 반대는 불가능)
const secretKey = required(
  'SOLANA_SECRET_KEY',
  'npm run sol:00 으로 지갑을 만든 뒤 출력된 비밀키를 넣으세요.',
);
const me = Keypair.fromSecretKey(bs58.decode(secretKey)).publicKey;

console.log(`  RPC     : devnet.helius-rpc.com (키는 가림)`);
console.log(`  내 주소 : ${me.toBase58()}`);

// 1 SOL = 1,000,000,000 lamports. 체인은 항상 정수(lamports)로만 다룬다.
const lamports = await connection.getBalance(me);
console.log(`\n  잔액    : ${lamports / LAMPORTS_PER_SOL} SOL  (${lamports} lamports)`);

if (lamports === 0) {
  console.log(`
⚠️  잔액이 0입니다. faucet 에서 devnet SOL 을 받으세요.
    https://faucet.solana.com  →  devnet  →  ${me.toBase58()}

    (잔액 0 상태로 전송을 시도하면 InsufficientFundsForFee 가 납니다.
     그건 03-fail-no-funds.ts 에서 일부러 해볼 예정입니다.)`);
} else {
  console.log(`\n✅ 전송 실습을 시작할 수 있습니다. → npm run sol:02`);
}

// 참고: 받는 쪽 주소도 함께 조회해보면 "전송 전후 비교"가 쉬워집니다.
const recipient = optional('SOLANA_RECIPIENT');
if (recipient) {
  const to = new PublicKey(recipient);
  const toLamports = await connection.getBalance(to);
  console.log(`\n  받는 주소 ${to.toBase58()}`);
  console.log(`  잔액      : ${toLamports / LAMPORTS_PER_SOL} SOL`);
}
