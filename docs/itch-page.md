# itch.io 페이지 — 「반송된 편지」

목적: 스팀 출시 전, 처음 보는 사람 5명에게서 반응을 받는다(로드맵 M0 통과 조건). 판매가 아니라 **무료 테스트 공개**다.

## 1. 패키지 만들기

```sh
tools/build-itch.sh                                         # 공유 문구 주소 = GitHub Pages letter.html
tools/build-itch.sh https://아이디.itch.io/returned-letter    # 페이지 주소가 정해진 뒤 다시 빌드
```

결과: `dist/itch/aduventure-returned-letter-<빌드>.zip`

| zip 안 | 역할 |
|---|---|
| `index.html` | itch.io가 여는 시작 파일. `game.html#returned-letter`로 넘긴다 |
| `game.html` | 게임 본체(`index.html` 사본). 「본편으로 돌아가기」를 누르면 본편으로 이어진다 |
| `art/` | 초상 그림 |

**검증한 것**: 다른 출처의 sandbox iframe(itch.io 방식) 안에서 시작 파일 → 체험 진입, 끝까지 진행, 새로고침 후에도 진행 유지, 본편 전환, 클립보드가 막혔을 때 직접 복사용 글상자 표시. 페이지 오류 없음.

## 2. 업로드 설정 (⚠ 메뉴 이름은 기억에 의존 — 실제 화면 기준으로 확인)

- Kind of project: **HTML**
- 업로드한 zip에 **This file will be played in the browser** 체크
- Embed options
  - Viewport: **480 × 800** 정도(세로형 한 열 레이아웃) ⚠추론
  - **Mobile friendly** 체크, 방향은 Portrait
  - **Fullscreen button** 켜기
  - **Enable scrollbars** 켜기(본문이 세로로 길다)
- Pricing: **No payments**
  - 후원(donation)도 영리 활동으로 볼 수 있다. 공무원 겸직 허가를 확인하기 전까지는 돈을 받는 선택지를 켜지 않는다 ⚠추론
- Visibility: 처음에는 **Restricted**(비밀번호 또는 비공개 링크)로 테스트할 5명에게만 준다. 반응을 본 뒤 Public으로 바꾼다 ⚠기억
- Cover image: `cover-630x500.png` (itch.io 권장 비율 630×500 ⚠기억)
- Screenshots: `shot-ko-*.png`, `shot-en-*.png`
- Genre: Interactive Fiction / Tags: `interactive-fiction`, `text-based`, `mystery`, `short`, `korean`, `bureaucracy`, `choices-matter`

## 3. 페이지 문구

### 제목
반송된 편지 · The Returned Letter

### 짧은 소개(한 줄)
- 한국어: 당신이 서명한 세 문장이, 다음 날 당신을 막는다.
- English: Sign three sentences. Tomorrow, they decide which doors open for you.

### 본문 — 한국어
소금여울 기록실의 아침. 배달되지 못한 편지 한 통과 반송 보고서 한 장이 당신 책상에 놓인다.

당신은 기록관이다. 배달이 끝나지 않은 이유, 수취인의 이름을 공개할지, 봉투에 딸린 별지를 어떻게 처리할지를 세 문장으로 적고 서명한다.

다음 날, 당신은 그 보고서 앞에 선 배달부가 된다. 문은 당신이 쓴 문장을 그대로 읽는다.

- 10분 남짓한 단편. 한국어·영어 지원
- 정답은 없다. 문장마다 열리는 문과 닫히는 문이 있다
- 원문과 서명은 지워지지 않는다. 고칠 수 있는 것은 그 아래에 덧붙이는 정정뿐이다
- 다른 문장으로 다시 살아 볼 수 있다

이 이야기는 장편 미스터리 「어두밴처」의 한 사건이다. 끝나고 나면 본편으로 이어서 할 수 있다.

### Body — English
Morning at the Saltmarsh Registry. An undelivered letter and a return report land on your desk.

You are the clerk. In three sentences you record why the delivery failed, whether to publish the recipient’s name, and what to do with the sealed enclosure. Then you sign.

The next day, you become the courier standing before that report. The door reads exactly what you wrote.

- A ten-minute short story in Korean and English
- No right answer: every sentence opens some doors and closes others
- The original and your signature stay. You can only append a correction below them
- Replay with different sentences and see which paths change

Part of the longer mystery *Aduventure*. When it ends, you can continue into the main game.

## 4. 테스트할 때 물을 것(`docs/playtest-pt44.md`와 같음)

1. 서명 직후: 2번 문장(이름 공개/봉인)을 왜 그렇게 골랐나?
2. 다음 날 게시판 장면 뒤: 무엇이 바뀌었고, 왜 그렇게 됐다고 생각하나?
3. "아무거나 골랐다"는 문장이 있었나? 있었다면 어느 것인가?
4. 15분 넘게 했나? 「문장을 바꿔 다시 살아 보기」를 눌렀나? 공유 버튼을 눌렀나?
