# DXF 도면 분석 보고서

분석일자: 2025-12-29

---

## 1. AEC Plan Elev Sample.dxf

### 파일 정보
| 항목 | 값 |
|------|-----|
| 파일명 | AEC Plan Elev Sample.dxf |
| 총 엔티티 수 | 8,064개 |
| 레이어 수 | 16개 |
| 블록 수 | 122개 |

### 도면 크기
- **너비**: 4,197.5 단위
- **높이**: 2,058.8 단위
- **범위**: X(-2052.6 ~ 2144.9), Y(-1074.6 ~ 984.2)

### 엔티티 유형별 분포
| 유형 | 개수 | 설명 |
|------|------|------|
| LINE | 4,988 | 직선 |
| LWPOLYLINE | 1,165 | 폴리라인 |
| TEXT | 687 | 텍스트 |
| INSERT | 602 | 블록 삽입 |
| ATTRIB | 188 | 속성 |
| HATCH | 164 | 해치 패턴 |
| ARC | 150 | 호 |
| DIMENSION | 80 | 치수 |
| CIRCLE | 17 | 원 |
| LEADER | 11 | 지시선 |
| MTEXT | 11 | 멀티텍스트 |
| SOLID | 1 | 솔리드 |

### 주요 레이어
| 레이어 | 엔티티 수 | 용도 |
|--------|----------|------|
| FURNITURE | 2,078 | 가구 배치 |
| WALL | 1,971 | 벽체 |
| TEXT | 954 | 텍스트/라벨 |
| HATCH | 915 | 해치 패턴 |
| STAIRS | 727 | 계단 |
| DETAIL | 520 | 상세도 |
| HIDDEN | 270 | 숨김선 |
| DIMENSIONS | 80 | 치수 |
| GRIDLINES | 45 | 그리드라인 |

### 도면 내용
건축 평면도 및 입면도 샘플:
- **왼쪽**: 다세대 주택 평면도 (여러 세대 유닛 배치)
- **오른쪽**: 건물 단면도/입면도 (3~4층 규모, 박공지붕)
- **중앙**: 범례 및 심볼

---

## 2. WOOD DETAILS.dxf

### 파일 정보
| 항목 | 값 |
|------|-----|
| 파일명 | WOOD DETAILS.dxf |
| 총 엔티티 수 | 1,731개 |
| 레이어 수 | 15개 |
| 블록 수 | 8개 |

### 도면 크기
- **너비**: 554.3 단위
- **높이**: 396.0 단위

### 엔티티 유형별 분포
| 유형 | 개수 | 설명 |
|------|------|------|
| LINE | 1,080 | 직선 |
| MTEXT | 343 | 멀티텍스트 |
| LEADER | 176 | 지시선 |
| CIRCLE | 30 | 원 |
| SPLINE | 26 | 스플라인 곡선 |
| HATCH | 26 | 해치 패턴 |
| ARC | 19 | 호 |
| TEXT | 12 | 텍스트 |
| POLYLINE | 11 | 폴리라인 |
| LWPOLYLINE | 7 | 경량 폴리라인 |
| INSERT | 1 | 블록 삽입 |

### 주요 레이어
| 레이어 | 엔티티 수 | 색상 | 용도 |
|--------|----------|------|------|
| 0 | 1,183 | 흰색 | 기본 도형 |
| TEXT | 431 | 녹색 | 텍스트/주석 |
| DIM | 93 | 빨간색 | 치수선 |
| Titleblock | 12 | 흰색 | 도면 테두리 |
| Insul | 11 | 파란색 | 단열재 |

### 도면 내용 (20개 상세도)

**1행 (상단)**
1. JOIST @ PARAPET WALL - 패러펫 벽체 장선 접합
2. FLOOR JOIST @ BEARING WALL - 내력벽 바닥 장선
3. INTERIOR PARTITION @ JOIST - 내부 칸막이벽 장선 접합
4. TRUSS & SOFFIT EXTERIOR WALL - 트러스 및 처마 외벽 접합
5. TYP TRUSS @ NON-BEARING INT. PARTITION - 비내력 칸막이 트러스

**2행**
6. HEADER ON BEAM @ DOORWAY - 출입구 보 헤더
7. HEADER ON BEAM @ OPENING - 개구부 보 헤더
8. TYPICAL SPLICE @ DOUBLE PLATE - 이중판 일반 이음
9. FRAMING @ ROOF OPENING - 지붕 개구부 프레이밍
10. PURL @ BEAM - 도리와 보 접합

**3행**
11. TYP END JOIST @ MASONRY WALL - 조적벽 끝단 장선
12. TYP LEDGER/TRUSS @ ROOF - 지붕 렛저/트러스
13. TYP LEDGER/TRUSS @ FLOOR - 바닥 렛저/트러스
14. MASONRY WALL INT. PITCHED TRUSS - 조적벽 경사 트러스
15. DOUBLE BRG. CONNECTING @ ROOF - 지붕 이중 베어링 연결

**4행 (하단)**
16. TYP TRUSS/END JOIST @ MAS. WALL - 조적벽 트러스/끝단 장선
17. DOUBLE ANGLE LINTEL @ BRG. PLATE - 베어링판 이중 앵글 린텔
18. BEAM CONNECTION @ MAS. WING WALL - 윙월 보 연결
19. BEAM @ PNL COLUMN - 패널 기둥 보
20. CONCRETE BASEMENT WALL - 콘크리트 지하벽

---

## 3. 06-M20.dxf (철골보접합표준도)

### 파일 정보
| 항목 | 값 |
|------|-----|
| 파일명 | 06-M20.dxf |
| 도면 제목 | 철골보접합표준도 (6) |
| 총 엔티티 수 | 6,562개 |
| 레이어 수 | 2개 |
| 축척 | S = 1 : 10 |

### 도면 정보
- **모재형**: SS400, SN400
- **볼트**: HTB-F10T, HTB-S10T
- **용지사이즈**: A2
- **참고문헌**: SCSS-H97
- **배포**: http://www.kozo-kogaku.co.jp (Ver1.00)

### 엔티티 유형별 분포
| 유형 | 개수 | 설명 |
|------|------|------|
| LINE | 5,672 | 직선 |
| CIRCLE | 564 | 원 (볼트 구멍) |
| TEXT | 294 | 텍스트 |
| ARC | 32 | 호 |

### 4가지 접합 상세도

#### 3-1. 보사이즈 H-194x150x6x9
| 구분 | 규격 | 수량 |
|------|------|------|
| 플랜지 외접판 | PL-290x150x9 | 2매 |
| 내접판 | PL-290x60x9 | 4매 |
| 웨브 접판 | PL-230x140x6 | 2매 |
| 볼트 | M20 | 16본 / 4본 |

#### 3-2. 보사이즈 H-294x200x8x12
| 구분 | 규격 | 수량 |
|------|------|------|
| 플랜지 외접판 | PL-410x200x9 | 2매 |
| 내접판 | PL-410x80x9 | 4매 |
| 웨브 접판 | PL-200x170x9 | 2매 |
| 볼트 | M20 | 24본 / 6본 |

#### 3-3. 보사이즈 H-244x175x7x11
| 구분 | 규격 | 수량 |
|------|------|------|
| 플랜지 외접판 | PL-290x175x9 | 2매 |
| 내접판 | PL-290x70x9 | 4매 |
| 웨브 접판 | PL-170x140x9 | 2매 |
| 볼트 | M20 | 16본 / 4본 |

#### 3-4. 보사이즈 H-340x250x9x14 (상세 분석)
| 구분 | 규격 | 수량 |
|------|------|------|
| 플랜지 외접판 | PL-530x250x12 | 2매 |
| 플랜지 내접판 | PL-530x100x12 | 4매 |
| 웨브 접판 | PL-290x200x9 | 2매 |
| 플랜지 볼트 | M20 | 32본 |
| 웨브 볼트 | M20 | 12본 |

**치수 정보**
- 플랜지 접합판 (530 x 250): 볼트 간격 40-60-60-90-60-60-40 (길이방향)
- 웨브 접합판 (290 x 200): 볼트 간격 40-60-90-60-40 (길이방향)

**접합 특징**
- 이중 커버 플레이트 방식 (외접판 + 내접판)
- 웨브 양면 덮개판으로 전단력 전달
- 고력볼트(HTB) M20 마찰접합 방식

---

## 4. house design.dxf (주택 평면도)

### 파일 정보
| 항목 | 값 |
|------|-----|
| 파일명 | house design.dxf |
| 도면 제목 | GROUND FLOOR PLAN |
| 대안 | Option-1, Option-2 |

### Option-1 vs Option-2 비교

#### 전체 구성 비교
| 구분 | Option-1 | Option-2 |
|------|----------|----------|
| 침실 수 | 2개 | 4개 |
| 화장실 수 | 1개 | 2개 |
| 상가 | SHOP 1, 2 | SHOP 1, 2 |
| 대상 | 소가족/부부 | 대가족 |

#### Option-1 상세
- BEDROOM 1: 상단 좌측
- BEDROOM 2: 중단 좌측
- LIVING AREA: 중앙 우측
- DINING AREA + CROCKERY CB: 상단 중앙
- KITCHEN 7'x8': 상단 우측
- TOILET: 중단 좌측
- STORAGE CB: 침실1 옆

#### Option-2 상세
- BEDROOM 1: 10'x11'-6" (중단)
- BEDROOM 2: 11'-9"x11'-6" (상단 우측)
- BEDROOM 3: 10'x9' (하단 좌측)
- BEDROOM 4: 10'x9' (하단 우측)
- DIN / LIVING AREA: 20'x11'-1" (통합)
- KITCHEN 7'x8': 상단 우측
- TOILET 10'x5': 2개
- SHOWER AREA: 별도 구획
- WARDROBE: 각 침실마다

#### 공통 사항
- 상가 (SHOP 1, 2): 1층 전면부
- MAIN ENTRANCE: 동일 위치
- 계단: 중앙 위치
- 전체 크기: 약 32' x 42'

---

## 분석 도구

- **DXF Viewer Extension**: VS Code용 DXF 뷰어 확장 프로그램
- **MCP Server**: stgen-dxf-viewer MCP 서버를 통한 도면 분석

---

*이 보고서는 Claude Code와 stgen DXF Viewer MCP를 사용하여 자동 생성되었습니다.*
