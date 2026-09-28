# 어두밴처 소규모 유료 플레이테스트 — 운영안

> 실제 게시·모집·녹화·송금은 아직 하지 않는다.
> `‹…›`는 저장소에서 알 수 없어 운영자가 채울 칸이다.

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
| 보상 | **참여자 수령 1만 원**, 세션 종료 후 **48시간 이내** | **원화 1만 원 상당 USD 수령액**을 선발 확정 때 고정. 실제 달러 숫자가 정해지기 전에는 모집 게시 안 함 |
| 지급 | 국내 계좌이체. 이체 수수료는 운영자가 따로 부담 | 페이팔(PayPal, 페이팔, 해외 송금에 쓰는 결제 계정). 수수료·환전은 별도(운영자 부담) |
| 빌드 | 헤더 `v0.7.3-pt4`. 설문에 자동 포함. 회차 시작 후 커밋 고정 | 같음. 우상단에서 EN |
| 모집 채널 (미게시) | Threads, 모집이 허용된 국내 게임 커뮤니티 | [r/playtesters](https://www.reddit.com/r/playtesters/) |
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

배포 방식: Settings → Pages → Source는 **Deploy from a branch** 유지. Branch는 `cursor/playtest-startable-6593`, 폴더는 `/`. `main` 병합은 하지 않는다. 이 주소의 게임이 pt4로 바뀌는 것을 전제로 한다.

`.github/workflows/pages.yml`은 **수동 실행(`workflow_dispatch`)만** 있다. push로 Pages를 배포하지 않는다.

헤더에 `v0.7.3-pt4`가 보이면 맞는 빌드다. 안 보이면 접속을 중단한다.

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

## 8. 모집문 — 한국어 (초안, 미게시)

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

## 9. 모집문 — English (draft, unpublished)

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


