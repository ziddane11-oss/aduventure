# 어두밴처 소규모 유료 플레이테스트 — 운영안

> **2026-09-28 실행 상태 — 이 블록과 16~19절을 아래의 이전 초안보다 우선한다.**
> 사용자가 모집 게시까지 진행하도록 승인했다. 신청 접수는 인스타그램 **@muscledoodoo DM**.
> 공개 빌드 **v0.7.3-pt6**, 게임 코드 커밋 **ee66c2d5e6eada1601f4290e1035905f01e3db83**.
> 실제 시트 ‘응답’ **129행 EN / 130행 KO**에서 요약 본문, 구조화된 답변, 언어, 빌드, 검증 ID의 저장을 확인했다. 검증 ID: `VERIFY_PT6_20260928_CHATGPT_EN` / `_KO`, 모두 NOT_A_PARTICIPANT.
> pt4는 답변 내용이 저장되지 않았고, pt5는 요약의 선행 = 문자가 수식으로 해석됐다. pt6에서 두 문제를 수정했다. 이전 pt4의 POST ok 기록을 답변 저장 성공으로 해석하지 않는다.
> 첫 모집 한·영 각 3명. 국내 수령 10,000원, 영어권 수령 **US$7.35** 고정, 세션 후 48시간 이내. 해외 수수료는 별도 운영자 부담. 환산 참고: Xe 2026-09-28 08:47 UTC, 10,000 KRW = 7.35249 USD (https://www.xe.com/currencyconverter/convert/?Amount=10000&From=KRW&To=USD). 실제 송금 환율은 다를 수 있으며 약속한 USD 수령액을 유지한다.
> 일정은 DM으로 가능 시간과 시간대를 받아 조율한다. 운영자의 빈 시간을 임의로 약속하지 않는다. 녹화는 별도 사전 동의, 거절해도 같은 보상.
> **영어 모집 게시 완료**: https://www.reddit.com/r/playtesters/comments/1ws9ye2/paid_735_net_via_paypal_40minute_observed_browser/ — u/Feeling-Search2339, Paid Playtest, 영어권 3명. 본문·신청 DM 계정·게시 화면을 확인했다.
> **한국어 모집 미게시**: 사용자가 디시 인디게임 갤러리와 루리웹 홍보 게시판 진행을 승인했다. 디시 글쓰기 화면에 제목·본문·실제 pt6 화면 3장을 입력/첨부했다. 비회원 글 비밀번호 및 자동등록방지 입력은 사용자에게 넘긴다. 루리웹은 로그인 처리 뒤 ‘잘못된 접근입니다’ 오류로 중단했다. 게시 URL은 아직 없다. 두 국내 채널을 합쳐 선발 3명, 신청은 Instagram @muscledoodoo DM. 자세한 작업 상태는 19절.
> Cursor는 x.ai SSO 단계 접근이 자동 심사에 차단되어, 동일 GitHub 테스트 브랜치에서 설문 저장만 직접 수정했다. 선발·세션·녹화·송금은 아직 수행하지 않았다.
> 한국어 수정 후 새 3명 계획은 유지하며, 영어 2회차는 열지 않는다.

> 아래의 예전 초안·검증 이력에 있는 ‘미게시’, pt4, USD 미정 표기는 당시 기록이다. 현재 실행 기준은 위 상태 블록과 16~19절이며, 영어 모집을 중복 게시하지 않는다.
> `‹…›`는 초기 초안의 미정 칸이다.

## 0. 한 줄 운영

**한국어 3명을 관찰한다 → 반복된 문제 2~3개를 고친다 → 새로운 한국어 3명에게 다시 본다. 영어권 3명도 같은 1회 방식으로 준비하되, 영어 2회는 아직 열지 않는다.**

질문은 하나다. **처음 만난 사람이 계속하고 싶은 게임인가.**

반드시 확인할 두 장면:

1. **고민한 선택**이 있었는지 → 있었다면 위치와 그때 예상한 결과
2. **계속할 마음이 사라진 장면**이 있었는지 → 있었다면 위치와 이유

없음 / 기억나지 않음도 정답이다.

## 1. 첫 회 운영표

| 항목 | 한국어 | 영어권 |
|---|---|---|
| 인원 | 처음 접하는 성인 3명 | 처음 접하는 성인 3명 |
| 구성 | RPG·선택형 경험 2 + 스토리 일반 1 | 같음 |
| 시간 | 준비 5 + 플레이 20 + 인터뷰 10 + 설문 5 = **약 40분** | 같음 |
| 방식 | 화면공유 관찰. 동의 후 게임 화면·음성만 기록(얼굴 없음) | 같음 |
| 보상 | **참여자 수령 1만 원**, 세션 종료 후 **48시간 이내** | **US$7.35 수령**으로 게시 완료. 세션 종료 후 48시간 이내, 수수료 운영자 부담 |
| 지급 | 국내 계좌이체. 이체 수수료는 운영자가 따로 부담 | 페이팔(PayPal, 페이팔, 해외 송금에 쓰는 결제 계정). 수수료·환전은 별도(운영자 부담) |
| 빌드 | 헤더 `v0.7.3-pt6`, 코드 `ee66c2d5e6eada1601f4290e1035905f01e3db83`. 설문에 자동 포함. 회차 시작 후 커밋 고정 | 같음. 우상단에서 EN |
| 모집 채널 | 디시 원고·사진 3장 입력 완료, 사용자 비밀번호·자동등록방지 처리 대기 / 루리웹 로그인 오류, 모두 미게시 | [r/playtesters 게시 완료](https://www.reddit.com/r/playtesters/comments/1ws9ye2/paid_735_net_via_paypal_40minute_observed_browser/) |
| 다음 | 수정 후 **새로운 한국어 3명** | 영어 2회는 아직 확정하지 않음 |

PlaytestCloud 등 대행은 이번 회에 쓰지 않는다. 서비스 이용료가 직접 모집 예산과 겹친다.

## 2. 예산

참여자 수령 기준. **해외 페이팔 수수료·환전은 별도**(운영자 부담). 추가 회차를 여기서 확정하지 않는다.

| 구성 | 금액 |
|---|---|
| 한국어 두 회 (3+3) | **6만 원** |
| 한국어 두 회 + 영어 한 회 (3+3+3) | **9만 원** |
| 한국어·영어 각각 두 회 (3+3+3+3) | **12만 원** |

지금 준비하는 범위: 한국어 두 회(6만) + 영어 한 회(3만) = **9만 원**. 영어 2회(추가로 3만, 합 12만)는 아직 열지 않는다.

## 3. 이번 테스트 접속 링크 (선택한 사이트)

**테스터에게 줄 주소:** https://ziddane11-oss.github.io/aduventure/

이 저장소에 이미 있는 GitHub Pages다. 새 호스팅은 만들지 않는다. 브라우저에서 게임이 실제로 뜨는 공개 HTTPS는 여기뿐이다.

배포 방식: Settings → Pages → Source는 **Deploy from a branch** 유지. Branch는 `cursor/playtest-startable-6593`, 폴더는 `/`. `main` 병합은 하지 않는다. 2026-09-28 공개 주소에서 pt6를 확인했다.

`.github/workflows/pages.yml` 자체는 **수동 실행(`workflow_dispatch`)만** 있다. 현재 선택한 Pages 브랜치 배포는 별도이며, 테스트 브랜치 변경으로 pt6가 공개 주소에 배포된 것을 확인했다.

헤더에 `v0.7.3-pt6`가 보이면 현재 모집용 빌드다. 다르면 세션을 시작하기 전에 확인한다.

## 4. 설문 (인게임 `🗒` / 피드백·그만두기)

고민한 선택 / 계속할 마음이 사라진 장면은 **먼저 있었는지** 묻고, 있었다면 위치와 이유를 받는다. 없음·기억나지 않음 허용.

지급 정보(계좌·페이팔)는 설문에 적지 않는다.

## 5. 녹화 동의문 초안 (얼굴 없음)

세션 시작 전 읽고 구두 또는 채팅으로 동의받는다. 아직 정하지 않은 값은 **제안값**이다.

### 한국어

이 테스트는 **게임 화면과 목소리만** 기록합니다. **얼굴(웹캠)은 요구하지 않고 녹화하지 않습니다.**

- 이용 목적: 어디서 선택을 고민했는지, 어디서 계속할 마음이 사라졌는지를 확인하고 게임을 고치기 위해서입니다. 홍보·광고·공개 업로드에 쓰지 않습니다.
- 열람 대상: 운영자(두두컴퍼니 / 개발자)만. 실명·얼굴·계좌는 기록에 넣지 않습니다. **제안값:** 개발 도구에 넘길 때는 참여자를 식별할 수 없는 장면 요약만 사용합니다.
- 보관: **제안값** — 해당 언어의 2회차 테스트가 끝난 날부터 30일, 또는 기록일부터 90일 중 **먼저 오는 날**까지.
- 삭제: 위 시점에 파일과 사본을 지웁니다. 참여자가 요청하면 **제안값**으로 요청 후 7일 안에 지웁니다.
- 거부: 화면공유 관찰만 하고 녹화 없이 진행할 수 있습니다. 거부로 지급이 줄지 않습니다.
- 지급 정보: 녹화·설문과 분리해 받고, 송금 후 보관 필요 없는 사본은 지웁니다. **제안값:** 거래 확인에 필요한 최소 기록만 세션+48시간과 정산 확인까지 둡니다.

### English

This session records **the game screen and your voice only**. **No webcam / no face recording is requested or stored.**

- Purpose: to see where you hesitated and where you lost the will to continue, so the game can be fixed. Not for ads, marketing, or public upload.
- Who can view: the operator (Dodu Company / the developer) only. Your legal name, face, and payment details are not put in the recording. **Proposed:** any note passed to a development tool is an anonymized scene summary only.
- Retention: **Proposed** — until 30 days after that language’s second-round test ends, or 90 days from the recording date, **whichever comes first**.
- Deletion: files are deleted at that point. On request, **proposed** deletion within 7 days.
- Refusal: we can observe over screen share without recording. Pay does not change if you refuse recording.
- Payment details are collected separately from the recording and survey.

## 6. 지급 원칙 — 평가 내용과 분리

모집문에 그대로 적는다. ‘도움이 된 의견만 지급’ 같은 운영자 판단 조건은 쓰지 않는다.

| 상황 | 지급 |
|---|---|
| 약속한 테스트·대화·설문 완료 | 전액 1만 원 / ₩10,000 |
| 재미없다는 평가, 혹평 | 동일하게 전액 |
| 게임 오류로 진행 불가 | 중단 상황과 경험을 보고하면 전액 |
| 지루해서 플레이 중단 | 남은 시간에 중단 이유를 인터뷰하고 전액 |
| 제출 자료 일부 누락 | 빠진 것을 알리고 **보완 기회**를 준 뒤, 보완되면 전액 |

지급 기한: 세션 종료 후 **48시간 이내**.

- 국내: 계좌이체. 참여자 통장에 **1만 원**이 입금되게 한다. 이체 수수료는 운영자 부담.
- 영어권 (**제안**): 원화 1만 원 상당의 **USD 수령액**을 **선발 확정 때 고정**한다.
  - 환산 기준 (**제안값**): 확정 시각의 한국수출입은행 매매기준율, 또는 페이팔 송금 화면에 보이는 원화→USD. 둘 중 하나를 운영자가 고르고 확정 메시지에 적는다.
  - 수수료: 페이팔 송금 수수료·환전 스프레드는 **별도, 운영자 부담**. 참여자가 받는 달러가 그 고정액이 되게 보낸다.
  - 한국 페이팔 계정은 한국 외 지역으로 보내는 용도이므로 국내 이체와 섞지 않는다.
  - **실제 달러 숫자가 모집문에 들어가기 전에는 영어 모집문을 게시하지 않는다.**

선발 확정 연락을 받은 사람만 유료 테스트를 시작한다. 신청만으로는 지급 대상이 아니다.

## 7. 짧은 신청서 (선발 확정 전에만)

게임 피드백·지급 정보와 분리한다.

1. 최근 즐긴 RPG·스토리 게임 1~2개와, 재미있었던 이유
2. 기기(폰 / 태블릿 / PC)와 가능한 시간대(시간대 포함)
3. 화면공유·음성 대화 가능 여부
4. 연락 방법
5. 언어: 한국어 / English
6. (확정 후에만) 국내 계좌 또는 페이팔 수령 이메일 — 신청서에 받지 않는다

**선발:** 장르 경험과 설명의 구체성. 경험자 2 + 일반 1.

## 8. 모집문 — 한국어 (이전 초안, 현재 게시용은 16~19절)

제목: [유료 플레이테스트] 텍스트 어드벤처 40분(플레이 20분+대화) · 수령 1만 원

개인이 만드는 **주사위 판정 텍스트 어드벤처**의 첫 관찰 테스트를 진행합니다. **어두밴처를 처음 접하는 성인 3명**을 찾습니다.

- 하는 일: 화상으로 화면을 공유한 채 약 20분 플레이 → 짧은 대화 → 5분 설문. 전체 약 40분.
- 보상: **계좌에 1만 원 입금** (세션 종료 후 48시간 이내). 이체 수수료는 운영자가 부담합니다.
- 필요: PC 또는 폰의 최신 브라우저, 화면공유·음성, 조용히 집중할 40분, 한국어
- 기록: 게임 화면과 음성을 **동의 후** 기록합니다. 얼굴·웹캠은 요구하지 않습니다. 초상·실명은 공개하지 않습니다.
- 접속: 확정 연락 때 빌드 `v0.7.3-pt4` 링크를 보냅니다.

**솔직한 경험이 목적입니다.** 재미없거나 중간에 그만둬도 됩니다. 좋은 평가·추천·좋아요는 요구하지 않습니다.

**지급 원칙:** 혹평이어도 전액. 오류로 진행이 안 되어도 그 경험을 말해 주시면 전액. 지루해서 멈춰도 남은 시간에 이유만 이야기하면 전액. 자료가 비면 보완 기회를 드린 뒤 전액.

신청 (짧게):

1. 최근 즐긴 RPG·스토리 게임 1~2개와 재미있었던 이유
2. 기기와 가능한 시간
3. 화면공유·음성 가능 여부
4. 연락 방법

**선발 확정 연락을 받은 분만** 유료 세션을 시작합니다. 신청만으로는 지급 대상이 아닙니다.

채널: Threads 또는 모집이 허용된 국내 게임 커뮤니티. 게시 전에 해당 채널 규칙을 다시 읽는다.

## 9. 모집문 — English (archived draft; published copy in sections 16–17)

**Channel (decided):** [r/playtesters](https://www.reddit.com/r/playtesters/). Do not post until the operator re-reads the live subreddit rules that day. **[미검증]** current flair/title format — Reddit blocked a live rules fetch in this environment.

Do not post this English draft until a concrete USD received amount is written in the title and body.

Title: [Paid] 40-min observed browser playtest (20-min play + talk) · $‹USD locked at selection, ₩10,000 equivalent› via PayPal

I'm running a small observed playtest of a **dice-driven mystery text adventure** I'm building solo (KO/EN toggle). Looking for **3 adults who have never played Aduventure**.

- What you do: Screen-share while you play ~20 minutes, then a short talk, then a 5-minute in-game form. About 40 minutes total.
- Reward: **$‹amount› received** via PayPal within 48 hours (₩10,000 equivalent, locked when I confirm you). I cover PayPal fees and FX so you receive that dollar amount.
- Needed: Modern browser (PC or phone), screen share + voice, 40 quiet minutes, English
- Recording: Game screen and voice **with consent**. No webcam / no face. No public use of your face or real name.
- Link: I send the `v0.7.3-pt4` URL only after you are selected.

**Honest reactions are the point.** Boring or quitting mid-session is fine. I do not ask for positive reviews, shares, or likes.

**Pay rules:** Harsh criticism is paid in full. If a bug blocks play and you report what happened, paid in full. If you stop because you are bored and we use the remaining time to talk about where/why, paid in full. If something is missing from the form, you get a chance to add it, then paid in full.

To apply (short):

1. 1–2 RPGs or story games you recently enjoyed, and why
2. Device + available times (include your timezone)
3. Screen-share + voice OK?
4. Contact method

**Only people who receive a confirmation message** start the paid session. Applying alone does not make you eligible for payment.

Do not put bank/PayPal details in the public post or the first application.

## 10. 세션 진행

### 준비 (5분)

1. 링크 확인 — 헤더 `v0.7.3-pt4`
2. 동의문(화면·음성, 얼굴 없음)
3. 언어 토글. 소리 켜기는 선택
4. “공략은 말하지 않습니다. 생각나는 건 편하게 말해 주셔도 되고, 대사를 읽는 동안 계속 말할 필요는 없습니다.”

### 플레이 (20분) — 관찰만

공략 금지. 무엇을 하려는지 본다. 멈춤·예상 밖 행동은 타임스탬프와 함께 적는다. 20분이면 멈춰도 되고, 더 하면 보상과 무관하다.

### 인터뷰 (10분)

- 고민한 선택이 있었나요? 있었다면 무엇을 하려고 했고 어떤 결과가 나올 줄 알았나요?
- 계속할 마음이 사라진 장면이 있었나요? 어느 장면, 왜?
- 다음 장면에서 궁금한 게 남았나요?

### 설문 (5분)

`🗒` → 제출. 가능하면 파일로 저장(.txt). 지급 정보는 `‹연락 수단›`으로 따로.

## 11. 지급 관리표 (비공개로 채움)

| 참여자 ID | 언어 | 약속 금액 | 테스트 일시 | 완료 | 지급 기한 | 이체일 | 거래번호 | 상태 |
|---|---|---|---|---|---|---|---|---|
| P1 | ko | 10,000 | ‹미정› | | 세션+48h | | | 대기 |
| P2 | ko | 10,000 | ‹미정› | | 세션+48h | | | 대기 |
| P3 | ko | 10,000 | ‹미정› | | 세션+48h | | | 대기 |
| E1 | en | ₩10,000 상당 USD (숫자 미정) | ‹미정› | | 세션+48h | | | 대기 |
| E2 | en | ₩10,000 상당 USD (숫자 미정) | ‹미정› | | 세션+48h | | | 대기 |
| E3 | en | ₩10,000 상당 USD (숫자 미정) | ‹미정› | | 세션+48h | | | 대기 |
| P4–P6 | ko | 10,000 | ‹1회 수정 후› | | 세션+48h | | | 대기 |
| E4–E6 | en | ‹USD, 미확정› | ‹영어 2회는 아직 열지 않음› | | 세션+48h | | | 대기 |

상태: `대기` / `기한 내 송금` / `보류` / `완료`.

## 12. 커서에 넘기는 정리

| 관찰한 사실 | 원인 가설 | 수정 후 확인할 것 |
|---|---|---|
| (예) | (예) | (예) |

```
참여자 ID:
언어: ko / en
빌드: v0.7.3-pt4
일시:
기기·브라우저:
고민한 선택 (있었는지 / 장면 / 하려던 것 / 예상):
계속할 마음이 사라진 장면 (있었는지 / 장면 / 이유):
멈춤·예상 밖 행동 (타임스탬프):
오류:
가설 (사실과 분리):
```

## 13. 체크리스트 (실행은 아직 하지 않음)

- [ ] 공개 링크 헤더 `v0.7.3-pt4` 확인
- [ ] 운영자가 GAS 시트에서 검증용 행(`VERIFY_PT4_…`)을 실제 참여자와 분리해 확인
- [ ] 동의문 제안값 수용 또는 수정
- [ ] 한국어 일정·연락 / 영어권 USD 금액·일정·연락
- [ ] 영어 모집문: 달러 숫자 확정 전에는 게시하지 않음
- [ ] 신청 접수 → 언어별 경험자 2 + 일반 1 → **확정 연락**
- [ ] 회차 시작 시 아래 빌드 고정 표에 커밋을 적는다
- [ ] 게시 직전 채널 규칙 재확인 (특히 r/playtesters)
- [ ] 한국어 1회 관찰 → 사실/가설 표 → 반복 문제만 수정 → 한국어 2회
- [ ] 48시간 내 지급, 관리표에 거래번호

## 14. 빌드 고정

선발 확정 연락을 보내는 시점이 회차 시작이다. 그때 빌드 태그와 커밋 SHA를 적고, 그 SHA의 `index.html`만 쓴다.

진행 불가 오류를 회차 중간에 고치면:

1. `BUILD` 태그를 올린다 (예: `v0.7.3-pt4` → `v0.7.3-pt5`)
2. 같은 Pages 브랜치에 푸시하고, 공개 주소 헤더가 새 태그인지 확인한다
3. 관리표에서 **수정 전 / 수정 후** 참여자를 나눈다. 같은 회차라도 빌드가 다르면 피드백을 섞어 해석하지 않는다

| 회차 | 빌드 | 커밋 | 비고 |
|---|---|---|---|
| 모집 전 배포 | v0.7.3-pt4 | b7bbc53ace745a1f96df335b531c310f6a7a5897 (`index.html` 내용 커밋 `99cc5c3`) | 공개 주소용. 회차 시작 전 |
| 한국어 1회 | | | 선발 확정 때 채움 |
| 영어 1회 | | | 선발 확정 때 채움. USD 숫자 확정 후 |

## 15. 운영자 검증 기록 (실제 참여자 아님)

인게임 설문에 아래 식별자를 넣어 보낸 행은 **배포 검증**이다. 참여자 피드백과 같은 칸에 두지 않는다.

- 접두어: `VERIFY_PT4_AGENT_`
- 이번 배포 검증 ID: `VERIFY_PT4_AGENT_20260928_b7bbc53_KO` / `_EN`
- `answers.bug` / `answers.more`에 `NOT_A_PARTICIPANT` 문구
- 시트에서 이 접두어로 필터해 분리하거나, 확인 후 검증 탭/삭제로 옮긴다

저장소와 GAS 응답에는 스프레드시트 URL이 없다. 시트는 해당 Apps Script 프로젝트에 연결된 스프레드시트다. 배포 URL:

`https://script.google.com/macros/s/AKfycbxFx_m5rhCZmqGoy3JcUUNqEgiObMWNHe9hx-LnZrhzIkfwa9-yJGBWP0lVulptnNQeCQ/exec`



## 16. 현재 모집 본문 (영어 게시 완료 / 한국어 미게시)

### 한국어

[유료 게임 테스트] 40분 · 1만 원 · 3명 모집

제가 만드는 주사위 판정 텍스트 어드벤처 ‘어두밴처’를 처음 해 볼 성인 3명을 찾습니다. 선택과 턴제 전투가 있는 미스터리 게임입니다.

• PC/노트북 브라우저에서 플레이 20분 + 준비·대화·설문, 총 약 40분
• 화면공유와 음성 대화 가능하신 분 / 웹캠 불필요
• 참여 보상: 계좌에 1만 원, 종료 후 48시간 이내 지급. 수수료는 제가 부담합니다.
• 재미없다는 평가도 환영합니다. 오류나 지루함으로 멈춰도 그 경험을 이야기하고 짧은 설문을 마치면 전액 지급합니다.
• 녹화는 사전에 별도로 동의받으며, 거절해도 참여와 보상에 영향이 없습니다.
• 일정은 가능한 시간을 받아 개별 조율합니다.

인스타그램 @muscledoodoo로 ‘어두밴처 테스트’라고 DM 주세요.
최근 즐긴 RPG·스토리 게임 1~2개와 재미있었던 이유, 기기·브라우저, 가능한 시간, 화면공유·음성 가능 여부를 짧게 보내 주시면 됩니다.
게임 경험이 많지 않은 분도 신청할 수 있습니다.

선발 확정 연락을 받은 분만 유료 세션을 시작합니다. 신청만으로 지급 대상이 되지는 않습니다. 확정 후 테스트 링크를 보내 드립니다.
좋은 평가·좋아요·팔로우는 요구하지 않습니다.

### English — r/playtesters / Paid Playtest (2026-09-28 게시 완료)

게시 URL: https://www.reddit.com/r/playtesters/comments/1ws9ye2/paid_735_net_via_paypal_40minute_observed_browser/

[Paid] $7.35 net via PayPal | 40-minute observed browser RPG playtest | 3 adults

I'm building Aduventure, a dice-driven mystery text adventure with branching choices and turn-based combat. I'm looking for 3 adults (18+) who have never played it, to help me understand which decisions are interesting and where the game loses their attention.

What you'll do:

- Play for about 20 minutes while sharing your game screen.
- Talk about your experience and complete a short in-game feedback form.
- Allow about 40 minutes total, including setup.

Payment:

- $7.35 USD received via PayPal within 48 hours after the session. I cover transfer fees so you receive the stated amount in USD.
- Honest criticism is paid in full.
- If a bug blocks you, or you stop because you're bored, we'll discuss what happened and finish the short form; you still receive the full amount.
- No purchase, positive review, like, follow, or public post is required.

Requirements:

- A PC or laptop with a modern browser, screen sharing, voice chat, and enough English for the game and discussion.
- An account able to receive international PayPal payments. Payment details are collected privately after selection, not in your application.
- No webcam. Recording is optional and requires separate advance consent; declining recording does not affect payment.
- We will agree on a session time individually. Please include your timezone.

To apply, DM @muscledoodoo on Instagram (https://www.instagram.com/muscledoodoo/) with "ADU EN" and:

1. One or two RPGs/story games you've enjoyed and why (newcomers are welcome too).
2. Your device and browser.
3. Your availability and timezone.
4. Whether screen sharing and voice chat are possible.

Only selected applicants who receive my confirmation should start a paid session. Applying by itself does not qualify for payment. I'll send the free browser-game link after confirming your slot, so we can observe your first impressions. Feedback will be collected in the session and the in-game form.


## 17. 2026-09-28 실제 모집 게시 기록

- 영어: r/playtesters, 계정 u/Feeling-Search2339, 플래어 Paid Playtest. 게시 URL: https://www.reddit.com/r/playtesters/comments/1ws9ye2/paid_735_net_via_paypal_40minute_observed_browser/
- 게시 직후 커뮤니티 피드와 새 탭의 글 상세에서 제목·전문·Instagram @muscledoodoo 신청·지급 조건을 확인했다. 당시 삭제/검토 대기 안내는 보이지 않았다. 향후 노출이나 참가자 확보를 보장하는 것은 아니다.
- 현재 영어권 모집은 3명, 40분, US$7.35 수령, 세션 후 48시간 이내, 해외 수수료 별도 운영자 부담. 영어 2회차는 열지 않는다.
- 공개 pt6에서 KO/EN 인게임 설문을 실제 제출하고 응답 시트 129·130행의 내용 및 extra JSON 저장을 확인했다. 검증용이며 참여자로 세지 않는다.
- 지원자 확인·선발·일정 확정·세션·녹화·송금은 아직 수행하지 않았다. 기존 운영표의 빈 칸을 임의로 채우지 않는다.
- 한국어 모집: 3명, 40분, 수령 1만 원. 당시 Threads 접근이 자동 심사에서 거절되었다. 이후 사용자가 Threads를 제외하도록 지시했으므로 아래 원고를 Threads에 게시하지 않는다. 새 모집 채널 검토는 18절.

### 이전 Threads 원고 (미게시·채널 제외, 398자)

[유료 게임 테스트] 40분·1만 원·성인 3명

제가 만드는 주사위 판정 텍스트 RPG ‘어두밴처’를 처음 해 볼 분을 찾습니다.
PC/노트북으로 20분 플레이+대화·설문, 총 40분. 화면공유·음성 대화 가능하신 분, 웹캠은 필요 없습니다.

종료 후 48시간 안에 계좌로 1만 원을 보내드립니다. 혹평·오류·지루함으로 중단해도 대화·설문을 마치면 전액 지급합니다. 녹화는 별도 동의이며 거절해도 보상은 같습니다.

인스타 @muscledoodoo로 ‘어두밴처 테스트’라고 DM 주세요. 즐긴 RPG·스토리 게임, 기기·브라우저, 가능한 시간을 보내주시면 됩니다. 일정은 개별 조율합니다.

선발 확정자만 유료 세션을 시작합니다. 신청만으로 지급되지는 않습니다. 좋은 평가·좋아요·팔로우는 요구하지 않습니다.


## 18. 2026-09-28 한국어 모집 채널 재조사 — Threads 제외

사용자가 ‘스레드 말고 다른 게임 덕후 사이트 찾아봐’라고 요청했다. 아래는 조사 결과이며 한국어 모집은 아직 게시하지 않았다. 선발 3명·40분·수령 10,000원·48시간 이내 지급·혹평 등과 지급 분리 조건은 유지한다.

| 후보 | 확인한 근거 | 이번 테스트에서의 판단 |
|---|---|---|
| 디시 인디게임 갤러리 https://gall.dcinside.com/mgallery/board/lists/?id=indiegame | 스스로 인디게임 소비자 커뮤니티로 규정. 2026-03-25 래토칼립스 테스트·설문 참여자에게 1만원 쿠폰을 제공하는 모집글을 확인 | 장르를 즐기는 플레이어를 찾는 우선 후보. 현금 지급을 명시적으로 승인한 별도 규정까지 확인한 것은 아님. 공지에 맞춘 게임 소개와 실제 화면 준비 필요 |
| 루리웹 앱 / 인디 추천 홍보 https://bbs.ruliweb.com/mobile/board/300034 | 운영자 공지가 홍보 대상으로 안내하는 게시판. 2026년 8월 히로윙 3명·사례비 15,000원·영상/설문 확인 후 48시간 지급 모집 사례와 9월 26일 PC 공포게임 테스터 모집글 확인 | 소규모 유료 모집과 가까운 사례가 있는 보조 후보. 오늘 목록에서 다수 글의 조회는 수십~100여 회 수준이므로 대형 사이트 전체 트래픽을 이 게시판 유입으로 간주하지 않음 |
| STOVE INDIE BOOST LAB https://forcreators.stoveindie.com/feedback | 공식 페이지가 STOVE 유저 테스트, 설문 템플릿, 참여/이벤트 보상 전액 지원을 안내 | 별도 신청 프로그램인 후속 후보. 현재 GitHub Pages 웹빌드의 참여 가능 여부 및 신청 조건은 아직 확인하지 않음 |

### 게시 규칙과 준비

- 디시 공지: 장르·플레이 흐름·차별점을 구체적으로 설명하고 실제 플레이 화면 3~6장 등 시각 자료를 권장한다. 개발자임을 밝히고 AI를 사용했다면 실제 사용 범위를 정직하게 설명한다. 개발자의 고생이나 개인 사정을 중심으로 쓰지 않는다.
- 디시 출처: https://gall.dcinside.com/mgallery/board/view/?id=indiegame&no=341199 (홍보 개발자 필독), https://gall.dcinside.com/mgallery/board/view/?id=indiegame&no=241263 (커뮤니티 규칙), https://gall.dcinside.com/mgallery/board/view/?id=indiegame&no=354335 (보상 있는 실제 테스트 모집 사례).
- 루리웹 인디게임 공략 게시판(299999)은 단순 홍보 금지. 운영자 공지 https://bbs.ruliweb.com/pc/board/299999/read/9 가 안내하는 앱/인디 추천 홍보 게시판(300034)을 사용한다.
- 루리웹 실제 사례: https://bbs.ruliweb.com/mobile/board/300034/read/300715 (히로윙 사례비 모집), https://bbs.ruliweb.com/mobile/board/300034/read/300782 (PC 공포게임 테스트 모집). 사례의 보상이나 유효 완료 기준을 우리 약속으로 복사하지 않는다.
- 신청은 Instagram @muscledoodoo DM. 돈/신청 조건 앞에 실제 게임 장르와 플레이 화면을 제시해 장르 취향이 맞는 사람이 판단할 수 있게 한다. 신규 게시 계정의 로그인 상태는 별도로 확인한다.


## 19. 2026-09-28 한국어 모집 게시 준비 — 아직 미게시

- 사용자가 국내 채널 진행을 승인했다. Threads는 계속 제외한다.
- 디시 인디게임 갤러리: https://gall.dcinside.com/mgallery/board/write/?id=indiegame 의 비회원 작성 화면에 닉네임 ‘어두밴처개발자’, 말머리 ‘📢소식’, 아래 제목·본문과 실제 pt6 스크린샷 3장을 넣었다. 작성 화면은 공개 게시글이 아니며, 아직 등록하지 않았다.
- 디시의 새 글 비밀번호 입력·자동등록방지·등록은 사용자가 직접 수행하는 마지막 단계로 남았다. 비밀번호를 임의 생성하거나 CAPTCHA를 대신 풀지 않았다.
- 루리웹 https://bbs.ruliweb.com/mobile/board/300034/write 는 로그인을 요구했다. 보안 로그인 요청 후 사용자가 직접 브라우저를 조작했고, 결과 화면에는 ‘잘못된 접근입니다. 로그인 페이지를 새로고침 후 다시 시도해주세요.’라고 표시됐다. 자동 로그인 재시도는 중단했으며, 원고 입력/게시는 하지 못했다.
- 캡처: 직업 선택, 탐색 선택지, 적 행동 예고가 있는 전투. 공개 게임 헤더 v0.7.3-pt6. 포스터 Gemini 표시를 게임 하단에서 확인했다. 실제 참여자 세션이나 제출이 아닌 소개용 검증 플레이다.
- 한국어 첫 회 선발은 두 게시판 전체 합계 3명이다. 게시판별로 3명씩 늘리지 않는다. 지급 조건과 DM 신청처는 그대로다.
- 공개 게시 URL은 아직 없음. 사용자 완료 후 실제 상세 URL과 본문·사진 표시를 확인한 뒤 이 절에 기록한다. 중복 게시 금지.

### 국내 게시용 제목

주사위 미스터리 RPG 어두밴처 테스트 모집 (40분·1만원)

### 국내 게시용 본문

안녕하세요. 주사위 판정과 선택으로 진행하는 텍스트 RPG ‘어두밴처’를 만들고 있습니다. 처음 해 볼 성인 3명을 모집합니다.

어떤 게임인가요?
폭풍의 밤, 꺼진 등대에 다시 불을 켜서 어선들을 구하는 이야기로 시작합니다. 파이터·로그·위저드 중 직업을 고르고, 상황을 읽은 뒤 행동을 선택합니다. 선택지에는 판정 성공 확률이 표시되고, 주사위와 능력치가 결과에 영향을 줍니다.
대화로 해결하거나 전투에 들어갈 수 있고, 전투에서는 적의 다음 행동을 보고 공격·방어·방해 중 무엇을 할지 고릅니다. 앞서 발견한 함정을 전투에 활용하는 선택도 있습니다.

아래 사진은 현재 브라우저 빌드(v0.7.3-pt6)의 실제 직업 선택·탐색·전투 화면입니다.
개발에는 Cursor·ChatGPT의 AI 코딩 도움을 사용했고, 시작 화면 포스터는 Gemini로 제작했습니다.

이번에 알고 싶은 것
어떤 선택에서 고민했는지, 어떤 장면에서 계속할 마음이 사라졌는지를 관찰해서 고치려 합니다. 좋은 말보다 당시 하려던 행동과 기대했던 결과를 듣고 싶습니다.

참여 조건과 보상
• 어두밴처를 처음 접하는 성인. RPG·스토리 게임을 많이 하지 않았어도 신청할 수 있습니다.
• PC/노트북 브라우저, 화면공유와 음성 대화가 필요합니다. 얼굴·웹캠은 필요 없습니다.
• 준비 5분 + 플레이 20분 + 대화 10분 + 설문 5분, 총 약 40분입니다.
• 1인 수령액 10,000원. 세션 종료 후 48시간 이내 계좌이체하며 수수료는 제가 부담합니다.
• 혹평을 하거나 오류·지루함으로 중단해도, 경험을 이야기하고 짧은 설문을 마치면 전액 지급합니다.
• 녹화는 별도 사전 동의를 받으며, 거절해도 참여와 보상에 영향이 없습니다.
• 좋은 평가·좋아요·팔로우·공개 후기 작성은 요구하지 않습니다.

신청 방법
인스타그램 @muscledoodoo (https://www.instagram.com/muscledoodoo/)로 ‘어두밴처 테스트’라고 DM 주세요.
1. 최근 즐긴 RPG·스토리 게임 1~2개와 재미있었던 이유
2. 기기와 브라우저
3. 가능한 날짜·시간
4. 화면공유와 음성 대화 가능 여부

일정은 개별 조율합니다. 국내 모집 채널 전체를 합쳐 3명이며, 선발 확정 연락을 받은 분만 유료 세션을 시작합니다. 신청만으로 지급 대상이 되지는 않습니다. 처음 접하는 반응을 보기 위해 게임 링크는 선발 확정 후 보내드립니다.
계좌 정보는 공개 댓글이나 첫 신청에 적지 마세요.
