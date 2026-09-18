/**
 * [Ethereum 00] Sepolia 지갑 만들기
 *
 * 가이드 5-A 체크리스트: "Sepolia 테스트넷 지갑 생성"
 *
 * 핵심 포인트 — Solana 00 과 똑같이, 네트워크 접속이 전혀 없습니다.
 * Tatum 도 여기선 등장하지 않습니다. 개인키는 로컬에서 태어나 로컬에 머뭅니다.
 *
 * 실행:  npm run eth:00
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { title } from "../config.ts";

title("Ethereum Sepolia 지갑 생성");

const privateKey = generatePrivateKey(); // 0x + 64자리 hex / 난수 32바이트 생성
const account = privateKeyToAccount(privateKey); //  개인키에서 주소 계산 + 서명 함수 묶어줌

console.log(`
✅ 지갑이 생성됐습니다.

  주소     : ${account.address}
  개인키   : ${privateKey}

다음 두 가지를 하세요.

  1) .env 파일에 개인키를 넣기
       ETH_PRIVATE_KEY=${privateKey}

  2) Sepolia ETH 받기 (무료 테스트 코인)
       https://www.alchemy.com/faucets/ethereum-sepolia
       https://cloud.google.com/application/web3/faucet/ethereum/sepolia
       → 위 주소를 붙여넣으세요.

⚠️  Sepolia faucet 은 "메인넷에 잔액이 있어야 지급" 같은 조건을 거는 곳이 많습니다.
    한 곳에서 막히면 다른 faucet 을 시도하세요. 이게 이 실습의 가장 흔한 병목입니다.
`);
