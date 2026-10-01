# 어두밴처 / Aduventure

주사위로 운명을 정하는 미스터리 텍스트 어드벤처. 한 파일(`index.html`)이며 한국어·영어를 우상단에서 고른다.

## 접속과 버전

**공개 주소:** https://ziddane11-oss.github.io/aduventure/

이 변경의 후보 빌드는 `v0.7.3-pt8`이다. 후보 브랜치의 코드가 공개 주소에 자동으로 배포되는 것은 아니다. 실제 배포 여부는 게임 헤더의 태그로 확인한다. 변경 내용과 검증 범위는 [pt8 작업 기록](docs/playtest-pt8.md)을 참고한다. 이전 상태·방어 설명 수정은 [pt7 작업 기록](docs/playtest-pt7.md)에 있다.

## 로컬 실행과 검증

```sh
python3 -m http.server 8080
```

브라우저에서 `http://localhost:8080/` — 후보 빌드 헤더는 `v0.7.3-pt8`.

Node.js 18 이상에서 네트워크 연결 없이 계산·렌더 입력 검증:

```sh
node --test tests/*.test.cjs
```

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
