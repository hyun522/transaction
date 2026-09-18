# 트랜잭션 랜딩 실습

솔라나(Helius)와 이더리움(Tatum)에 직접 트랜잭션을 보내보는 실습 저장소입니다.
개념 정리와 체크리스트는 [`tx-guide.md`](./docs/tx-guide.md) 에 있습니다.

> ⚠️ **전부 테스트넷 전용입니다.** Solana devnet / Ethereum Sepolia.
> 실제 돈이 들어있는 지갑의 개인키를 이 저장소에 넣지 마세요.

---

## 스택

| 항목 | 선택 |
|---|---|
| 런타임 | Node.js (TypeScript는 `tsx` 로 바로 실행 — 빌드 단계 없음) |
| 솔라나 | `@solana/web3.js` v1 |
| 이더리움 | `viem` v2 (함수 이름이 `eth_*` RPC 메서드와 1:1 대응) |
| 환경변수 | Node 내장 `--env-file` (별도 dotenv 패키지 없음) |

---

## 시작하기

```bash
# 1. 의존성 설치 (이미 되어 있다면 생략)
npm install

# 2. 환경변수 파일 만들기
cp .env.example .env

# 3. 지갑 생성 — API 키 없이도 바로 됩니다
npm run sol:00      # 솔라나 지갑 → 출력된 비밀키를 .env 에 붙여넣기
npm run eth:00      # 이더리움 지갑 → 출력된 개인키를 .env 에 붙여넣기
```

그다음 **API 키 2개**와 **테스트 코인**을 준비합니다.

| 준비물 | 어디서 | 비고 |
|---|---|---|
| `HELIUS_API_KEY` | https://helius.dev | 무료 티어 |
| `TATUM_API_KEY` | https://tatum.io | 무료 티어 |
| devnet SOL | https://faucet.solana.com | 네트워크를 **devnet** 으로 |
| Sepolia ETH | https://www.alchemy.com/faucets/ethereum-sepolia | 가장 막히기 쉬운 단계 |

준비가 끝나면 잔액 조회로 연결을 확인합니다.

```bash
npm run sol:01      # 솔라나 잔액
npm run eth:01      # 이더리움 잔액 + nonce + gas price
```

---

## 스크립트 목록

파일 번호는 [`tx-guide.md`](./docs/tx-guide.md) 6번 섹션의 **"안 되는 거" 4가지 유형**과 대응합니다.

### 솔라나 (`src/solana/`)

| 명령 | 파일 | 하는 일 | 가이드 대응 |
|---|---|---|---|
| `npm run sol:00` | `00-create-wallet.ts` | 키페어 생성 (네트워크 접속 없음) | 4-A |
| `npm run sol:01` | `01-balance.ts` | 잔액 조회 (읽기 — 서명 불필요) | 4-A |
| — | `02-send.ts` | ✅ 성공 케이스 전송 | 4-B |
| — | `03-fail-no-funds.ts` | ❌ `InsufficientFundsForFee` | ① 접수 거부 |
| — | `04-fail-old-hash.ts` | ❌ `BlockhashNotFound` | ② 대기하다 소멸 |
| — | `05-simulate.ts` | 전송 전 시뮬레이션 · 원자성 확인 | 4-D |

### 이더리움 (`src/ethereum/`)

| 명령 | 파일 | 하는 일 | 가이드 대응 |
|---|---|---|---|
| `npm run eth:00` | `00-create-wallet.ts` | 지갑 생성 (네트워크 접속 없음) | 5-A |
| `npm run eth:01` | `01-balance.ts` | 잔액 · nonce · gas price 조회 | 5-A |
| — | `02-send.ts` | ✅ 성공 케이스 전송 | 5-B |
| — | `03-fail-nonce.ts` | ❌ `nonce too low` | ① 접수 거부 |
| — | `04-low-gas.ts` | ⏳ 낮은 gas → 영구 pending | ② 대기하다 소멸 |
| — | `05-revert.ts` | 💸 receipt status 0 + 가스비 소모 | ③ 리버트 |

`—` 표시된 스크립트는 아직 만들지 않았습니다. API 키를 발급받고 `01` 이 성공하면 이어서 작성합니다.

---

## 자주 겪는 문제

| 증상 | 원인 / 해결 |
|---|---|
| `.env not found. Continuing without it.` | `cp .env.example .env` 를 아직 안 했습니다. |
| `❌ .env 에 XXX 가 비어 있습니다` | 해당 값을 채우세요. 메시지에 발급처 링크가 같이 나옵니다. |
| 잔액이 계속 0 | faucet 지급에 수십 초 걸릴 수 있습니다. Etherscan/Solana Explorer 로 확인하세요. |
| Sepolia faucet 이 거부 | 대부분 "메인넷 잔액 보유" 조건 때문입니다. 다른 faucet 을 시도하세요. |

`npm run typecheck` 로 타입 오류를 미리 확인할 수 있습니다.
