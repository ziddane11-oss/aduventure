# 어두밴처 / Aduventure

주사위로 운명을 정하는 미스터리 텍스트 어드벤처. 한 파일(`index.html`)이며 한국어·영어를 우상단에서 고른다.

## 접속과 버전

**공개 주소:** https://ziddane11-oss.github.io/aduventure/

이 변경의 빌드는 `v0.7.3-pt13`이다. 후보 브랜치의 코드가 공개 주소에 자동으로 배포되는 것은 아니다. 실제 배포 여부는 게임 헤더의 태그로 확인한다. 회차를 넘는 미스터리·사건 기록장·에필로그는 [pt13 작업 기록](docs/playtest-pt13.md), 배경음과 선택 직전 예고는 [pt12 작업 기록](docs/playtest-pt12.md), 1장의 결과·패배 후 경로는 [pt11 작업 기록](docs/playtest-pt11.md), 규칙별 피해와 전투 검증은 [pt10 작업 기록](docs/playtest-pt10.md), 행동 기록은 [pt9 작업 기록](docs/playtest-pt9.md)을 참고한다.

## 로컬 실행과 검증

```sh
python3 -m http.server 8080
```

브라우저에서 `http://localhost:8080/` — 빌드 헤더는 `v0.7.3-pt13`.

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
