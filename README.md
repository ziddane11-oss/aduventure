# 어두밴처 / Aduventure

주사위로 운명을 정하는 미스터리 텍스트 어드벤처. 한 파일(`index.html`)이며 한국어·영어를 우상단에서 고른다.

## 접속

**공개 주소:** https://ziddane11-oss.github.io/aduventure/

이번 테스트 빌드는 `v0.7.3-pt4`. 헤더에 이 태그가 보여야 한다.

## 로컬에서 열기

```
python3 -m http.server 8080
```

브라우저에서 `http://localhost:8080/` — 헤더에 `v0.7.3-pt4`.

## 배포

GitHub Pages → 깃허브 페이지스, 저장소 HTML을 HTTPS로 여는 호스팅.

- Source: **Deploy from a branch** (GitHub Actions로 바꾸지 않음)
- Branch: `cursor/playtest-startable-6593`
- Folder: `/`
- `main` 병합으로 배포하지 않음

`.github/workflows/pages.yml`은 **수동 실행(`workflow_dispatch`)만** 있다. push 때는 돌지 않는다. Source를 GitHub Actions로 바꾼 뒤에만 그 워크플로를 쓴다. 지금은 브랜치 배포를 쓴다.

## 피드백

인게임 `피드백·그만두기`는 Google Apps Script로 `playtest_feedback`을 보낸다. 진행 불가 JS 오류는 `type: "error"`. `VERIFY_PT4_AGENT_`로 시작하는 제출은 운영자 검증이며 참여자 피드백이 아니다.
