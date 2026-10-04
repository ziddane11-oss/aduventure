# 그림 지시서 — ChatGPT(이미지 생성)에 그대로 붙여 넣는 용

> **pt41 현재 기준:** 세온·베른·렌은 잉크 판화풍 실물 이미지로 교체했다. 나머지 인물의 제작에는 [이번 프롬프트](portrait-prompts-pt41.md)와 세 이미지를 기준으로 화풍을 맞춘다. 아래 인물 설정은 유지하되, 이전의 도형 위주 공통 화풍은 더 이상 목표가 아니다.

> 목적: 인물 8명 + 장면 그림을 **같은 화풍**으로 맞춘다. 한 장씩 따로 부탁하면 화풍이 흔들리므로, 매번 **[공통 화풍]을 먼저 붙이고** 인물/장면 설명을 덧붙인다.
> 게임 안에 넣는 법: 파일을 `art/` 폴더에 넣고 `index.html`의 `const PORTRAIT_FILES = {};`에 `seon: "art/seon.png"`처럼 경로만 적으면 코드로 그린 초안 대신 그 그림이 이름 옆에 뜬다.

## [공통 화풍] — 모든 요청 맨 앞에 붙인다
```
Style: monochrome ink illustration on aged paper. Grayscale only, with ONE accent color: deep red ink (#C0392B), used sparingly and only where noted.
Flat geometric shapes, bold silhouettes, strong contrast, minimal detail, no gradients except subtle paper grain.
Face shading split in two halves (left darker, right lighter). Small simple eyes, no exaggerated anime features.
Square 1:1 portrait, head and shoulders, plain dark background (#121110) with faint paper texture.
No text, no letters, no watermark.
```
(한국어 설명: 낡은 종이 위 먹 그림, 회색조 + 붉은 잉크 한 색, 도형 위주의 굵은 실루엣, 얼굴 명암은 반으로 나눔, 정사각형 흉상, 글자 없음)

## 인물 (파일 이름 = 게임 속 id)
| id | 이름 | 붙일 설명(영문) | 붉은색을 쓰는 곳 |
|---|---|---|---|
| `seon` | 세온 — 소금여울 촌장 | A village chief in his fifties, perfectly neat side-parted hair, a smile that is too straight, high collar, holding a teacup. Calm, polite, unsettling. | 찻잔 가장자리에 붉은 잉크 한 방울 |
| `bern` | 베른 — 늙은 등대지기 | An old lighthouse keeper, weathered face, thick beard, knit cap, bandage on the back of the head, guilty downcast eyes. | 붕대에 번진 붉은 점 |
| `ren` | 렌 — '갈고리' 도굴꾼 | A wiry grave-robber in his thirties, hood, a rusted iron hook over one shoulder, scar across the cheek, cocky grin. | 갈고리 끝의 녹(붉게) |
| `scully` | 스컬리 — 검은 코트의 심부름꾼 | A nervous errand man in a long black coat, thin face, slicked hair, a thin dagger, sweat on the brow. | 칼날 한 줄 |
| `odo` | 오도 — 잿돌 수도원 종지기 | A frightened bell-keeper monk, shaved head, rope-worn hands, two torches crossed behind him. | 횃불 하나만 붉게 |
| `pip` | 핍 — 붙잡혀 있던 배달부 | A young courier, messenger cap, mailbag strap across the chest, tired but defiant eyes, wet hair. | 우편 가방의 봉랍(밀랍 도장) |
| `grey` | 회색 형제 — 가짜 수도사 | A tall false monk in a grey hood, face mostly hidden in shadow, heavy iron candlestick. | 촛불 불꽃 |
| `ire` | 이레 — 먹울의 눈먼 낭독가 | A woman who is blind, eyes gently closed, ink-stained fingertips resting on an open manuscript, calm faint smile. | 손끝의 잉크 |

**요청 예시(그대로 복사):**
```
[공통 화풍 블록]
Character: An old lighthouse keeper, weathered face, thick beard, knit cap, bandage on the back of the head, guilty downcast eyes.
Red ink accent only on: a small spot bleeding through the bandage.
```

## 장면(무대) 그림 — 가로 16:9, 같은 화풍
| 장면 | 설명 |
|---|---|
| 1장 등대 | A lighthouse on a cliff in a storm at night, the lamp dark, rain lines, tiny figure at the door. Red accent: none (or a single red light on the sea). |
| 2장 부두 | A foggy fishing wharf at dusk, a tavern sign "anchor", stacked crates, a black-coated figure disappearing. Red: the tavern lantern. |
| 3장 수도원 | A silent stone monastery on a mountain at noon, bell tower with a cut rope. Red: the cut end of the rope. |
| 사건 2 필사소 | Endless shelves of manuscripts in a dark scriptorium, a single candle. Red: many small red marks in book margins. |

## 금지·주의
- 실존 인물·기존 게임 캐릭터를 닮게 하지 말 것(예: Reigns, ALTER EGO 캐릭터 이름을 넣지 않는다).
- 학생 그림·실명 크레딧을 받는 기존 정책(`ART_CREDIT`)과 겹치면 학생 작품을 우선한다.
- 생성 그림의 사용 조건은 사용하는 서비스 약관을 따른다.
