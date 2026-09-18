/**
 * [Solana 00] devnet 지갑(키페어) 만들기
 *
 * 가이드 4-A 체크리스트: "devnet 지갑(키페어) 생성"
 *
 * 핵심 포인트 — 이 스크립트는 네트워크에 아무것도 보내지 않습니다.
 * 키페어 생성은 순수하게 로컬 수학 연산입니다. Helius 는 아직 등장조차 안 합니다.
 * "서명은 내 지갑이, 전달만 RPC 가" 라는 원칙의 출발점입니다.
 *
 * 실행:  npm run sol:00
 */
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { title } from '../config.ts';

title('Solana devnet 지갑 생성');

const keypair = Keypair.generate();

// 공개키(=주소): 남에게 알려줘도 되는 값. 계좌번호 같은 것.
const address = keypair.publicKey.toBase58();
// 비밀키: 절대 공유 금지. 인감도장 그 자체.
const secretKey = bs58.encode(keypair.secretKey);

console.log(`
✅ 지갑이 생성됐습니다. (아직 네트워크에 존재하지 않습니다 — 잔액이 0이므로)

  주소(공개키)   : ${address}
  비밀키(base58) : ${secretKey}

다음 두 가지를 하세요.

  1) .env 파일에 비밀키를 넣기
       SOLANA_SECRET_KEY=${secretKey}

  2) devnet SOL 받기 (무료 테스트 코인)
       https://faucet.solana.com  →  네트워크 devnet 선택  →  위 주소 붙여넣기

⚠️  이 비밀키는 devnet 전용으로만 쓰세요. 실제 돈이 있는 지갑을 여기 쓰면 안 됩니다.
    .env 는 .gitignore 에 들어 있어 커밋되지 않습니다.
`);
