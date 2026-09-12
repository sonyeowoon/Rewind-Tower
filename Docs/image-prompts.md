# Rewind Tower 이미지 생성 프롬프트

## 1. 생성 순서와 사용 방법

1. 먼저 `00-style-reference.png`를 생성한다.
2. 결과가 마음에 들면 이후 모든 이미지 생성에서 해당 이미지를 스타일 참조 이미지로 첨부한다.
3. 각 리소스를 한 장씩 따로 생성한다. 여러 타일이나 오브젝트를 한 이미지에 한꺼번에 생성하지 않는다.
4. 아래의 **공통 스타일 프롬프트 + 개별 리소스 프롬프트 + 공통 제외 프롬프트** 순서로 합쳐 입력한다.
5. 캐릭터와 오브젝트는 가능한 경우 투명 PNG로 생성한다. 투명 배경을 지원하지 않으면 단색 배경으로 생성한 뒤 제거한다.
6. 최종 게임에서는 정사각형 타일을 64×64픽셀 정도로 축소해 사용한다. 원본은 선명한 편집을 위해 크게 생성한다.

GPT 이미지 생성은 정확한 격자 분할이나 완전한 심리스 타일을 항상 보장하지 않는다. 생성 후 테두리, 중심 정렬, 투명 영역과 반복 이음새를 확인해야 한다.

## 2. 공통 스타일 프롬프트

아래 문장을 모든 개별 프롬프트의 맨 앞에 동일하게 붙인다.

```text
Create a production-ready 2D game asset for an original fantasy clockwork puzzle game called Rewind Tower. Use one consistent clockpunk fantasy art direction: clean hand-painted 2D illustration, crisp readable silhouettes, softly cel-shaded forms, subtle storybook texture, compact slightly chibi proportions, mysterious but friendly rather than frightening. Use a limited unified palette of deep midnight navy #10182B, slate blue #27334A, antique brass gold #D6A84B, luminous time-cyan #5DE0E6, and restrained arcane violet #8B5CF6. Materials are aged stone, dark iron, antique brass, glass, and faint magical time energy. Use soft upper-left lighting, restrained highlights, medium contrast, and shapes that remain recognizable when reduced to 64 pixels. Keep the same line weight, material rendering, lighting direction, palette, scale language, and top-down three-quarter orthographic viewpoint across every gameplay asset. This is flat 2D game artwork, not a 3D render and not pixel art.
```

## 3. 공통 제외 프롬프트

아래 문장을 각 프롬프트의 마지막에 붙인다. 개별 프롬프트에 다른 지시가 있으면 개별 지시를 우선한다.

```text
Exclude all readable text, letters, numbers, logos, watermarks, signatures, brand marks, UI screenshots, photographic realism, 3D-render appearance, pixel-art dithering, anime franchise references, excessive ornament, gore, horror imagery, modern electronic devices, unrelated props, duplicate objects, cropped edges, inconsistent perspective, harsh bloom, heavy fog, and cast shadows extending outside the asset bounds. Do not depict a checkerboard transparency pattern.
```

## 4. 스타일 기준 이미지

### 00. 스타일 레퍼런스 보드

- 파일명: `00-style-reference.png`
- 권장 비율: 1:1
- 용도: 이후 모든 생성 이미지의 참조 이미지

```text
[공통 스타일 프롬프트]

Create a square visual style reference board for Rewind Tower. Present one consistent young clock-tower explorer, one stone floor sample, one brass-edged wall sample, one golden time gear, one cyan-glowing hourglass, one circular time anchor, one clockwork exit door, and one violet time rift. Arrange them as clean separated visual samples with generous spacing and no overlap. Show the explorer once as a full-body top-down three-quarter character, wearing a short deep-navy hooded coat, antique-brass shoulder guards and belt fittings, dark trousers, sturdy boots, and a small cyan-glowing pocket-watch device held near the chest. The character should feel curious and brave, gender-neutral, friendly, and easy to recognize at small size. Keep every sample at a coherent scale and demonstrate the exact palette, line quality, lighting, material treatment, and magical glow intended for all later assets. Use a plain neutral dark-blue presentation background only for this reference board.

[공통 제외 프롬프트]
```

## 5. 필수 게임 이미지

### 01. 플레이어 4방향 스프라이트 시트

- 파일명: `player-directions.png`
- 리소스 종류: 캐릭터 스프라이트
- 권장 비율: 4:1 또는 넓은 가로형
- 배경: 투명
- 사용 목적: 방향키 이동 시 바라보는 방향 표시

```text
[공통 스타일 프롬프트]

Create a clean four-cell character direction sprite sheet for the Rewind Tower player character, using the approved explorer design from the style reference. Show exactly four separate full-body views of the same character in this order from left to right: facing down toward the viewer, facing left, facing right, and facing up away from the viewer. Use a top-down three-quarter orthographic game view. The character wears a short deep-navy hooded coat, small antique-brass shoulder guards and belt pieces, dark trousers, sturdy boots, and a cyan-glowing pocket-watch device. Keep identical body proportions, clothing, colors, lighting, scale, and foot position in all four views. Each figure must be centered inside an equal invisible square cell, fully visible with generous transparent padding, with no overlap and no separator lines. Neutral idle stance only. Transparent background with clean alpha edges.

Exclude extra characters, alternate costumes, weapons, labels, arrows, cell borders, ground tiles, scenery, motion blur, walking animation frames, cropped feet, and mismatched sizes.

[공통 제외 프롬프트]
```

### 02. 시계탑 바닥 타일

- 파일명: `floor-stone.png`
- 리소스 종류: 반복형 맵 타일
- 권장 비율: 1:1
- 배경: 불투명
- 사용 목적: 이동 가능한 기본 바닥

```text
[공통 스타일 프롬프트]

Create one square seamless top-down floor tile for the interior of an ancient clock tower. Use worn midnight-navy and slate-blue stone slabs with very subtle antique-brass inlay lines and restrained age marks. The center must stay visually quiet so the player and items remain readable. Use an exact top-down orthographic tile view, even lighting from the upper left, no perspective convergence, and edges designed to repeat seamlessly on all four sides. Fill the entire square canvas with the tile surface. Opaque background.

Exclude objects, characters, gears as separate items, cracks that imply danger, holes, strong directional shadows, bright focal points, borders, bevelled outer frames, transparent areas, and visible seams.

[공통 제외 프롬프트]
```

### 03. 시계탑 벽 타일

- 파일명: `wall-stone.png`
- 리소스 종류: 충돌 타일
- 권장 비율: 1:1
- 배경: 불투명
- 사용 목적: 플레이어가 통과할 수 없는 벽

```text
[공통 스타일 프롬프트]

Create one square wall-block tile for a top-down three-quarter orthographic clock tower game. Depict a thick raised block of dark slate masonry capped with worn dark iron and narrow antique-brass trim. The top surface and a small front-facing vertical edge should be visible, making the tile clearly taller and impassable compared with the floor. Keep the silhouette square and the outer edges tileable with neighboring identical wall blocks. Use subtle upper-left highlights and a compact shadow contained inside the square canvas. Opaque background filling the tile.

Exclude doors, windows, loose objects, readable symbols, vines, extreme damage, holes, long shadows, transparent corners, irregular outer silhouette, and side-view perspective.

[공통 제외 프롬프트]
```

### 04. 시간 톱니바퀴

- 파일명: `time-gear.png`
- 리소스 종류: 수집 아이템
- 권장 비율: 1:1
- 배경: 투명
- 사용 목적: 출구 개방에 필요한 필수 수집품

```text
[공통 스타일 프롬프트]

Create one centered collectible time gear for a top-down puzzle game. It is a compact symmetrical antique-brass cog with eight clearly readable teeth, a small clock-face-like circular center without numbers, and a thin cyan magical glow around the inner ring. Show it hovering slightly in a top-down three-quarter orthographic view. Make the silhouette bold and instantly identifiable at 32 to 64 pixels. Keep the object fully inside the canvas with generous transparent padding and a very small soft contact glow directly beneath it. Transparent background.

Exclude extra gears, chains, text, clock numbers, hands shaped like letters, excessive tiny mechanical detail, large aura, ground tile, cropped teeth, and asymmetrical deformation.

[공통 제외 프롬프트]
```

### 05. 모래시계

- 파일명: `hourglass.png`
- 리소스 종류: 능력 충전 아이템
- 권장 비율: 1:1
- 배경: 투명
- 사용 목적: 되감기 횟수 1회 제공 및 기준점 생성

```text
[공통 스타일 프롬프트]

Create one centered magical hourglass collectible for Rewind Tower. Use a compact antique-brass frame, clear glass bulbs, and luminous cyan sand visibly flowing downward. Add a restrained violet glint to suggest unstable time energy. Show the whole object upright from a top-down three-quarter orthographic view, with a bold readable silhouette, clean edges, and proportions suitable for a 64-pixel game item. Add only a tight soft cyan glow around the object. Transparent background with generous padding.

Exclude hands, extra hourglasses, broken glass, floating text, clock numbers, scenery, floor tile, oversized particle clouds, extreme bloom, and cropped frame pieces.

[공통 제외 프롬프트]
```

### 06. 시간 기준점

- 파일명: `time-anchor.png`
- 리소스 종류: 바닥 오버레이 효과
- 권장 비율: 1:1
- 배경: 투명
- 사용 목적: 되감기로 돌아갈 위치 표시

```text
[공통 스타일 프롬프트]

Create one circular time-anchor floor overlay viewed directly from above. Design a clean antique-brass ring containing a simple radial clockwork motif and three small cyan energy segments orbiting clockwise. The middle must remain mostly transparent so the underlying floor and player remain visible. Keep all glow and particles inside the square canvas, with a crisp circular silhouette and restrained cyan-violet magical light. The asset must align to the center of one square grid tile. Transparent background.

Exclude readable runes, letters, numbers, pentagrams, religious symbols, large particles, solid filled background, characters, objects, perspective tilt, and glow extending beyond the canvas.

[공통 제외 프롬프트]
```

### 07. 닫힌 출구

- 파일명: `exit-closed.png`
- 리소스 종류: 맵 오브젝트
- 권장 비율: 1:1
- 배경: 투명
- 사용 목적: 수집 완료 전 잠긴 출구 표시

```text
[공통 스타일 프롬프트]

Create one closed clockwork exit gate occupying a single square grid tile. Use a heavy round dark-iron door set inside a compact slate-stone arch, with antique-brass gear mechanisms and a central circular lock. The mechanisms are motionless and the cyan light is faint, clearly communicating that the exit is inactive. Show it from the same top-down three-quarter orthographic viewpoint as the wall tile. Keep the full arch and its compact contained shadow within the square canvas. Transparent background around the structure.

Exclude readable signs, keyholes shaped like letters, characters, open gaps, bright active glow, extra scenery, long shadows, cropped arch pieces, and front-on side-scroller perspective.

[공통 제외 프롬프트]
```

### 08. 열린 출구

- 파일명: `exit-open.png`
- 리소스 종류: 맵 오브젝트 상태 이미지
- 권장 비율: 1:1
- 배경: 투명
- 사용 목적: 모든 톱니바퀴 수집 후 탈출 가능 상태 표시

```text
[공통 스타일 프롬프트]

Create the exact same clockwork exit gate as the approved closed exit asset, with identical arch shape, scale, camera angle, materials, lighting, and canvas position, but now fully activated and open. The round iron door has retracted into the arch, revealing a clean dark passage filled with controlled cyan time light. The brass gears are aligned and softly illuminated. Make the open state unmistakable without changing the outer silhouette. Keep the full asset and compact shadow within one square tile. Transparent background around the structure.

Exclude characters, readable signs, a different door design, altered camera angle, blinding white portal, huge particle effects, scenery, cropped edges, and long shadows.

[공통 제외 프롬프트]
```

### 09. 시간 균열

- 파일명: `time-rift.png`
- 리소스 종류: 위험 바닥 오버레이
- 권장 비율: 1:1
- 배경: 투명
- 사용 목적: 밟으면 실패하는 위험 타일

```text
[공통 스타일 프롬프트]

Create one dangerous time-rift floor overlay aligned to a single square grid tile, viewed directly from above. Depict a sharp irregular crack with a dark violet center, restrained violet energy along the edges, and a few tiny cyan time fragments being pulled inward. Keep the visual readable but not frightening, with no gore and no creature. The crack should occupy the central 70 percent of the tile while the outer area remains transparent, allowing it to sit over the normal floor. Keep all glow contained inside the canvas.

Exclude lava, blood, monsters, hands, faces, black-hole scenery, smoke covering the tile, large particles, text, solid background, and glow outside the canvas.

[공통 제외 프롬프트]
```

### 10. 메인·로그인 화면 배경

- 파일명: `menu-background.png`
- 리소스 종류: 와이드 배경 일러스트
- 권장 비율: 3:2 또는 16:9
- 배경: 불투명
- 사용 목적: 로그인 화면과 메인 메뉴 공용 배경

```text
[공통 스타일 프롬프트]

Create a wide atmospheric menu background for Rewind Tower. Show the interior of a vast ancient clock tower from a slightly elevated viewpoint: enormous shadowed gears, narrow brass mechanisms, worn stone architecture, suspended dust, and a distant circular opening emitting soft cyan time light. Keep the central 45 percent of the image calm, dark, low-detail, and uncluttered so HTML login and menu panels can be placed there with strong readability. Place richer gear silhouettes mainly along the left and right edges. Use deep navy and slate as the dominant colors, antique brass as secondary detail, and restrained cyan-violet accents. No character and no interface elements. Opaque full-canvas background.

Exclude text, title lettering, buttons, forms, logos, centered focal objects, bright central highlights, photorealism, 3D render appearance, crowded composition, and important details near the outer crop-safe margins.

[공통 제외 프롬프트]
```

### 11. 메뉴·모달 장식 프레임

- 파일명: `ui-panel-frame.png`
- 리소스 종류: UI 프레임
- 권장 비율: 4:3
- 배경: 투명
- 사용 목적: 로그인, 조작법, 튜토리얼과 결과 모달 장식

```text
[공통 스타일 프롬프트]

Create one large empty fantasy clockwork UI panel frame. Use a thin antique-brass outer frame with restrained corner gears, a dark translucent-looking midnight-navy inner panel, and a subtle cyan highlight along the upper edge. Keep the center completely empty and visually quiet for HTML text and buttons. The frame must be symmetrical, front-facing, rectangular with gently rounded corners, and suitable for scaling as a decorative overlay. Keep all ornament attached to the border and all edges fully visible. Transparent background outside the panel.

Exclude any text, icons, buttons, input fields, characters, scenery, asymmetrical ornaments, thick bulky borders, excessive gears, perspective tilt, cropped corners, and drop shadows extending beyond the canvas.

[공통 제외 프롬프트]
```

### 12. 튜토리얼·HUD 아이콘 세트

- 파일명: `ui-icons.png`
- 리소스 종류: UI 아이콘 시트
- 권장 비율: 3:2
- 배경: 투명
- 사용 목적: 조작법, 튜토리얼, 저장, 계정과 음소거 버튼

```text
[공통 스타일 프롬프트]

Create a precisely organized six-cell icon sheet for Rewind Tower. Arrange exactly six isolated square icons in two rows of three with equal spacing and no cell borders. Top row: a four-direction arrow symbol, a counter-clockwise rewind arrow surrounding a tiny cyan clock, and an antique-brass save disk symbol redesigned with clockwork details. Bottom row: a simple explorer profile silhouette, a speaker with sound waves, and a speaker with one diagonal mute slash. Use crisp flat 2D icon shapes, dark navy bases, antique-brass outlines, and small cyan highlights. Make every icon centered, equal in scale, legible at 24 to 32 pixels, and fully separated on a transparent background.

Exclude text, letters including W A S D or R, numbers, captions, button backgrounds, extra icons, uneven cells, overlapping elements, realistic portraits, modern brand logos, and cropped shapes.

[공통 제외 프롬프트]
```

## 6. 선택 기능용 이미지

### 13. 무너지기 전 발판

- 파일명: `fragile-floor.png`
- 사용 목적: 한 번만 통과할 수 있는 발판의 초기 상태

```text
[공통 스타일 프롬프트]

Create one square seamless fragile floor tile viewed directly from above. Match the approved normal stone floor exactly in scale, palette, lighting, and material, but add a readable network of thin cracks concentrated near the center and a few tiny loosened brass inlay pieces. It must look unstable yet still walkable. Fill the entire opaque square canvas and keep the outer edges compatible with the normal floor tile.

Exclude holes, missing center, deep abyss, characters, items, bright magic, danger symbols, borders, perspective tilt, and cracks crossing every edge in a way that breaks tiling.

[공통 제외 프롬프트]
```

### 14. 무너진 발판

- 파일명: `collapsed-floor.png`
- 사용 목적: 통과 후 사라진 발판 상태

```text
[공통 스타일 프롬프트]

Create the collapsed state of the approved fragile floor tile with identical tile size, palette, camera, lighting, and edge alignment. Show a dark impassable hole in the center with several broken slate-stone pieces and bent brass inlay fragments around the rim. The hole must be visually clear at 64 pixels, while the outer border remains compatible with neighboring floor tiles. Opaque square tile, exact top-down view, restrained contained shadow.

Exclude lava, blood, monsters, endless scenery, excessive debris, text, objects hovering over the hole, perspective mismatch, and fragments extending outside the canvas.

[공통 제외 프롬프트]
```

### 15. 시간 열쇠

- 파일명: `time-key.png`
- 사용 목적: 선택 퍼즐의 잠긴 문 개방

```text
[공통 스타일 프롬프트]

Create one centered collectible time key. Design a short antique-brass key with a circular gear-shaped bow, a simple clock-hand-inspired shaft, and a tiny cyan crystal set into the center. Show it hovering in the same top-down three-quarter orthographic viewpoint as the time gear and hourglass. Use a bold compact silhouette, restrained glow, generous transparent padding, and clean alpha edges for a 64-pixel game item.

Exclude extra keys, key rings, chains, text, numbers, ornate filigree, weapons, floor tile, large aura, cropped ends, and side-view inconsistency.

[공통 제외 프롬프트]
```

### 16. 잠긴 퍼즐 문

- 파일명: `locked-door.png`
- 사용 목적: 열쇠가 필요한 통로 차단

```text
[공통 스타일 프롬프트]

Create one compact locked clockwork barrier for a single square grid tile. Match the approved wall and exit assets in stone, dark iron, antique brass, scale, lighting, and top-down three-quarter orthographic viewpoint. The barrier is a smaller rectangular gate with one clear circular brass lock plate and inactive cyan channels. It must clearly read as a locked passage rather than the final exit. Keep the full object and its contained shadow inside the square canvas, with transparent background around it.

Exclude readable symbols, giant keyholes, characters, open gaps, bright active glow, a round final-exit shape, scenery, long shadows, and cropped edges.

[공통 제외 프롬프트]
```

### 17. 열린 퍼즐 문

- 파일명: `unlocked-door.png`
- 사용 목적: 열쇠 사용 후 통과 가능한 문 상태

```text
[공통 스타일 프롬프트]

Create the exact opened state of the approved locked puzzle door, preserving identical scale, frame, materials, viewpoint, lighting, and canvas position. Retract the rectangular gate panels into the side frame, remove the active lock obstruction, and show a clear walkable passage with a small controlled cyan indicator light. The exterior silhouette should remain almost unchanged so the two states swap cleanly in game. Transparent background around the full structure.

Exclude a different frame design, characters, readable signs, a glowing portal, excessive particles, changed camera angle, scenery, long shadows, and cropped edges.

[공통 제외 프롬프트]
```

### 18. 되감기 잔상 효과

- 파일명: `rewind-trail.png`
- 사용 목적: 플레이어가 기준점으로 돌아갈 때 겹쳐 표시하는 시각 효과

```text
[공통 스타일 프롬프트]

Create a standalone magical rewind trail effect for overlaying behind a moving character. Form a short curved ribbon of translucent cyan time energy flowing backward, with three faint afterimage arcs, tiny antique-brass clock fragments, and restrained violet accents. The effect should imply reverse motion without containing a character. Keep the center readable, all particles within the canvas, and the silhouette compact enough for use across two or three grid tiles. Transparent background with clean alpha and no solid floor.

Exclude characters, faces, text, numbers, complete clocks, explosions, lightning storm, huge bloom, dense smoke, solid background, long uncontrolled particles, and cropped glow.

[공통 제외 프롬프트]
```

## 7. 리소스 일관성 체크리스트

- [ ] 모든 게임 타일이 같은 탑다운 또는 탑다운 3/4 시점을 사용한다.
- [ ] 조명은 항상 화면의 왼쪽 위에서 온다.
- [ ] 바닥, 벽, 출구와 문이 같은 크기의 타일에 맞는다.
- [ ] 금속은 황동 금색, 시간 에너지는 청록색, 위험 요소는 보라색으로 구분된다.
- [ ] 캐릭터 4방향의 의상, 체형, 색상과 크기가 동일하다.
- [ ] 닫힌 출구와 열린 출구의 외곽 형태와 위치가 동일하다.
- [ ] 잠긴 문과 열린 문의 외곽 형태와 위치가 동일하다.
- [ ] 투명 이미지에 흰색 또는 체크무늬 배경이 실제 픽셀로 남아 있지 않다.
- [ ] 모든 오브젝트가 잘리지 않고 중앙에 배치된다.
- [ ] 64×64 또는 실제 적용 크기로 축소해도 정체가 구분된다.
- [ ] 이미지 안에는 게임 제목, 버튼명, 닉네임, PIN 등 글자를 생성하지 않는다.
- [ ] 로그인 입력창과 버튼 글자는 이미지가 아니라 HTML과 CSS로 구현한다.

## 8. 최소 생성 권장 순서

개발 시간을 줄이려면 다음 순서로 생성한다.

1. 스타일 레퍼런스
2. 플레이어 4방향
3. 바닥과 벽
4. 시간 톱니바퀴와 모래시계
5. 시간 기준점
6. 닫힌 출구와 열린 출구
7. 시간 균열
8. 메인·로그인 배경
9. UI 프레임과 아이콘
10. 선택 기능 이미지

