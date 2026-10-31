# 어두밴처 PR 자동 점검

## 하는 일

같은 저장소의 PR이 열리거나 새 커밋으로 갱신되면 `tests/*.test.cjs`를
Node.js 22에서 실행한다. GitHub Agentic Workflows가 해당 PR의 변경사항과
테스트 작업 결과를 살피고 PR에 한국어 요약 댓글을 남긴다. 테스트가 실패하면
가능한 범위에서 실패 로그와 관련 변경사항을 바탕으로 원인과 다음 조치를 적는다.
로그를 읽지 못하거나 원인이 불확실하면 그 사실을 표시한다.

워크플로는 코드를 수정하거나 PR을 승인·병합하거나 게임을 배포하지 않는다.
다른 저장소의 fork에서 올라온 PR에는 이 설정이 실행되지 않는다.

## 활성화 전에

1. 저장소에서 GitHub Actions 사용이 허용되어 있어야 한다.
2. 이 설정은 Copilot 엔진을 사용한다. Copilot CLI를 사용할 수 있는 계정의
   fine-grained personal access token을 준비하고 사용자 권한에서
   **Copilot Requests: Read**를 부여한다.
3. 저장소 **Settings → Secrets and variables → Actions → New repository secret**에
   `COPILOT_GITHUB_TOKEN`이라는 이름으로 해당 토큰을 저장한다. 토큰 값은
   채팅이나 저장소 파일에 올리지 않는다.
4. 두 워크플로 파일을 검토한 다음, 리뷰할 PR의 대상 브랜치에 반영한다.
   사용자가 검토·승인하기 전에는 자동으로 병합하지 않는다.
5. 그 후 같은 저장소에서 해당 브랜치로 테스트 PR을 열고, **Actions**에서
   `어두밴처 PR 분석` 실행과 PR 댓글을 확인한다. 정상 실행과 테스트 실패 양쪽을
   각각 확인한다. 이 워크플로를 처음 추가하는 PR 자체의 실행은 대상 브랜치에
   워크플로 원본이 없어서 정상 검증이 안 될 수 있다.

대상 브랜치 `cursor/playtest-startable-6593`는 GitHub Pages 공개 브랜치이므로,
워크플로만 추가하는 병합도 기존 Pages 배포 설정에 따라 사이트 갱신을 일으킬 수
있다. 현재 배포 설정을 확인하고 승인한 뒤 진행한다.

Copilot 및 GitHub Actions 사용량은 계정의 요금제와 사용량에 따라 비용이 들 수
있다. ChatGPT 구독과 별도로 Copilot 사용 권한이 필요하다.

## 수정할 때

원본은 `.github/workflows/aduventure-pr-review.md`, GitHub Actions가 실제로
실행하는 파일은 `.github/workflows/aduventure-pr-review.lock.yml`이다. 설정을
바꾸면 [GitHub Agentic Workflows 공식 가이드](https://docs.github.com/en/copilot/how-tos/github-agentic-workflows/creating-github-agentic-workflows)에
따라 `gh aw compile`로 다시 생성하고 두 파일을 함께 검토한다.
