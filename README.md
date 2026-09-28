# 어두밴처 / Aduventure

주사위로 운명을 정하는 미스터리 텍스트 어드벤처. 한 파일(`index.html`)이며 한국어·영어를 우상단에서 고른다.

## 지금 테스트에 쓸 접속 링크

**이번 유료 테스트 빌드:** `v0.7.3-pt4` (이 저장소의 현재 작업 브랜치)

기존 GitHub Pages 주소는 살아 있다.

- https://ziddane11-oss.github.io/aduventure/
- 배포 소스: `main` 루트, 마지막 성공 빌드 `b412626` (2026-09-16)
- 페이지 타이틀: `어두밴처 v0.7.3`
- **이번 테스트에 쓰지 않는다.** 언어 토글·2단계 설문·`v0.7.3-pt4`가 없다.

**테스터에게 줄 주소는 GitHub Pages 한 곳이다.** https://ziddane11-oss.github.io/aduventure/

jsDelivr·githack·htmlpreview는 이 파일에서 게임이 켜지지 않음을 확인했다. Pages가 `v0.7.3-pt4`를 내기 전까지는 이 링크로 유료 테스트를 시작하지 않는다.

## 로컬에서 열기

```
python3 -m http.server 8080
```

브라우저에서 `http://localhost:8080/` — 화면 헤더에 `v0.7.3-pt4`가 보여야 한다.

## 배포 (이미 Pages가 있는 저장소)

이 게임은 정적 `index.html` 하나다. 새 호스팅을 만들지 않는다.

Pages를 이번 빌드에 맞추려면 **설정 한 가지**만 하면 된다.

1. GitHub → Settings → Pages → Source를 **Deploy from a branch**로 둔 채
2. Branch를 이 테스트 브랜치(또는 머지 후 `main`)로 바꾸고 폴더는 `/`

또는 Settings → Pages → Source를 **GitHub Actions**로 바꾸고, 이 저장소의 `.github/workflows/pages.yml`을 쓴다. 워크플로는 `main`과 `cursor/playtest-startable-6593` push에 동작한다.

## 피드백이 가는 곳

인게임 `피드백·그만두기`는 Google Apps Script 엔드포인트로 `playtest_feedback`을 보낸다. 진행 불가 JS 오류는 같은 파이프로 `type: "error"`를 보낸다. 시트/메일 화면에서 행이 보이는지는 운영자가 한 번 확인하면 된다.
