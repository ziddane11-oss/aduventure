# 어두밴처 / Aduventure

목격한 진실로 거짓된 공식 기록을 고치는 미스터리 텍스트 어드벤처. 한 파일(`index.html`)이며 한국어·영어를 우상단에서 고른다.

## 접속과 버전

**공개 주소:** https://ziddane11-oss.github.io/aduventure/

새 세션은 [스팀 로드맵](docs/roadmap-steam.md)부터 읽는다. 이 변경의 빌드는 `v0.7.3-pt41`이다. 가독성·초상 3종·신규 플레이테스트 기준은 [pt41 작업 기록](docs/playtest-pt41.md)을 참고한다. 첫 정정·증거 대조·판결 후 만남과 상태 오류 수정은 [pt40 작업 기록](docs/playtest-pt40.md), 헷갈림 점검과 아스트라 검토 요청서는 [pt39 작업 기록](docs/playtest-pt39.md)·[검토 요청서](docs/astra-review.md), 「이의 있음」 쉽게는 [pt38 작업 기록](docs/playtest-pt38.md), 아이캐치(기록 도장·장 전환 카드)는 [pt37 작업 기록](docs/playtest-pt37.md), 시즌 1 피날레 「제113호」는 [pt36 작업 기록](docs/playtest-pt36.md), 한 장씩 끊어 하기·1장 결투 한 박자는 [pt35 작업 기록](docs/playtest-pt35.md), 장 끝 화면 줄이기는 [pt34 작업 기록](docs/playtest-pt34.md), 미감 C안(고대비·큰 글씨) 적용은 [pt33 작업 기록](docs/playtest-pt33.md), 후보 브랜치의 코드가 공개 주소에 자동으로 배포되는 것은 아니다. 실제 배포 여부는 게임 헤더의 태그로 확인한다. 사건 2 완결·첫 판에 판결은 [pt32 작업 기록](docs/playtest-pt32.md), 1000명 시뮬·구입 인터뷰와 막힘 수정은 [pt31 작업 기록](docs/playtest-pt31.md), 선택지 접기·다시 하기 빨리 넘기기·사건판 추론은 [pt30 작업 기록](docs/playtest-pt30.md), 가상 플레이어 100명 시뮬레이션과 거기서 찾은 버그 수정은 [pt29 작업 기록](docs/playtest-pt29.md), 소리 기본 켜기·쉬워진 반박은 [pt28 작업 기록](docs/playtest-pt28.md), 재미 묶음(기록 반박·의뢰·결투 시간 제한·선택 비율·인물 대사)은 [pt27 작업 기록](docs/playtest-pt27.md), 인물 초상 초안은 [pt26 작업 기록](docs/playtest-pt26.md), 휴대폰 한 손 플레이(한 줄 막대·자동 위치)는 [pt25 작업 기록](docs/playtest-pt25.md), 몰입 패치(흑백·붉은 잉크·문단 번짐·초상 자리)는 [pt24 작업 기록](docs/playtest-pt24.md), 덜어내기(꼬리표 하나·숫자 숨김·회차별 공개)는 [pt23 작업 기록](docs/playtest-pt23.md), 사건 2 「붉은 손글씨」 1장은 [pt22 작업 기록](docs/playtest-pt22.md), 해 지기 전 두 곳(시간 예산 탐문)은 [pt21 작업 기록](docs/playtest-pt21.md), 흉터·오판과 재심은 [pt20 작업 기록](docs/playtest-pt20.md), 직업마다 다른 길은 [pt19 작업 기록](docs/playtest-pt19.md), 지난 회차에 간 길·안 가 본 길 표시는 [pt18 작업 기록](docs/playtest-pt18.md), 붉은 쪽지·판결이 바꾸는 첫 화면은 [pt17 작업 기록](docs/playtest-pt17.md), 2·3장 서사 결투는 [pt16 작업 기록](docs/playtest-pt16.md), 1장 서사 결투·갈림길·위치 카드·효과음은 [pt15 작업 기록](docs/playtest-pt15.md), 첫 화면의 공식 기록과 회차 번호는 [pt14 작업 기록](docs/playtest-pt14.md), 회차를 넘는 미스터리·사건 기록장·에필로그는 [pt13 작업 기록](docs/playtest-pt13.md), 배경음과 선택 직전 예고는 [pt12 작업 기록](docs/playtest-pt12.md), 1장의 결과·패배 후 경로는 [pt11 작업 기록](docs/playtest-pt11.md), 규칙별 피해와 전투 검증은 [pt10 작업 기록](docs/playtest-pt10.md), 행동 기록은 [pt9 작업 기록](docs/playtest-pt9.md)을 참고한다.

## 로컬 실행과 검증

```sh
python3 -m http.server 8080
```

브라우저에서 `http://localhost:8080/` — 빌드 헤더는 `v0.7.3-pt41`.

Node.js 18 이상에서 네트워크 연결 없이 계산·렌더 입력 검증:

```sh
node --test tests/*.test.cjs
```

실제 전투 핸들러를 사용하는 밸런스 시뮬레이션과 1장 장면 도달률 추정:

```sh
node tests/balance-sim.cjs index.html 3000 20261001
node tests/reach-sim.cjs index.html 3000 20261001
```

마지막 인자는 난수 시드다. 같은 코드·판수·시드는 같은 결과를 낸다. 시뮬레이션의 행동 방침과 시작 조건은 고정된 가정이며 실제 플레이어의 승률이나 재미를 측정하지 않는다. 시간 초과는 별도 집계한다. 도달률에서 `렌 재회 조건`은 2장 재회를 실제로 봤다는 뜻이 아니다.

이 테스트는 실제 브라우저의 레이아웃·저장 복원·설문 수신 확인을 대체하지 않는다.

## 배포

GitHub Pages → 깃허브 페이지스, 저장소 HTML을 HTTPS로 여는 호스팅.

- Source: **Deploy from a branch**
- Branch: `cursor/playtest-startable-6593`
- Folder: `/`
- `main` 병합으로 배포하지 않음

`.github/workflows/pages.yml`은 **수동 실행(`workflow_dispatch`)만** 있다. push 때는 돌지 않는다. 지금은 브랜치 배포를 쓴다.

## 피드백

인게임 `피드백·그만두기`는 Google Apps Script로 `playtest_feedback`을 보낸다. 진행 불가 JS 오류는 `type: "error"`. `VERIFY_PT4_AGENT_`로 시작하는 제출은 운영자 검증이며 참여자 피드백이 아니다.
