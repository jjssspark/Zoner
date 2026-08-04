# Zoner 학습 세션 · 집중도 리포트 파이프라인 — 설계

## 배경

Zoner는 auth+DB 연동 이후, Mypage에 연결된 나머지 기능(`/save`, `/read`, `/report_a`, `/save_report`, `/trash`, `/trashread`, `/ai-chat`, `/start-learning`)이 전부 Figma-export 그대로의 미완성 스캐폴드다. 스타일 없는 "rectangle" div가 콘텐츠 자리를 채우고 있고, 이름은 "Jisu"로 하드코딩되어 있으며, 실제 데이터·로직이 전혀 없다. `/ai-chat`, `/start-learning`은 라우터에 등록조차 안 되어 있어 지금 눌러도 404다.

이 기능들은 하나의 스펙으로 묶기엔 범위가 커서 서브프로젝트로 분해했다:

1. **학습 세션 기록 · 집중도 리포트 파이프라인** (이 문서의 범위)
2. 휴지통 (삭제·복원) — 1번 완료 후 그 데이터에 대한 CRUD로 추가
3. AI 채팅 — 독립 기능, 별도 스펙

"학습 시작"은 애초에 학습 기록과 집중도 리포트를 만들어내는 입구이기 때문에, 이 셋은 독립된 기능이 아니라 하나의 파이프라인으로 묶인다.

## 아키텍처

프론트엔드에서 Supabase를 직접 호출하는 기존 구조(별도 백엔드 서버 없음)를 그대로 따른다. 웹캠 프레임은 브라우저를 절대 벗어나지 않는다 — 클라이언트 사이드 CV 라이브러리(`@mediapipe/tasks-vision`의 `FaceLandmarker`)로 5초 간격 얼굴 방향을 분석해 "집중/비집중" 틱만 메모리에 누적하고, 세션 종료 시 그 틱을 집계한 결과(종합 점수 + 1분 단위 집중도 비율)만 Supabase Postgres에 저장한다. 영상·프레임 자체는 어디에도 전송·저장하지 않는다 — API 키 노출 리스크도 없고, Supabase 무료 스토리지 용량(1GB) 제약도 피한다.

`FaceLandmarker`는 CDN에서 WASM/모델을 런타임에 fetch하는 구조라(`FilesetResolver.forVisionTasks`, `FaceLandmarker.createFromModelPath`), `/start-learning` 라우트에서 동적 import로만 로드하면 메인 번들 크기에 영향이 없다 (`web/performance.md`의 "무거운 라이브러리 동적 임포트" 원칙).

## 데이터 모델

`.claude/standards/db-conventions.md` 규약(snake_case, 타임스탬프+동작+대상 마이그레이션 파일명, RLS)을 따른다.

```sql
create table study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds int not null,
  focus_score int not null,          -- 0~100, 전체 집중 틱 비율
  timeline jsonb not null,           -- [{ "minute": 0, "focus_ratio": 0.8 }, ...]
  created_at timestamptz not null default now()
);

alter table study_sessions enable row level security;

create policy "study_sessions_select_own"
  on study_sessions for select
  using (auth.uid() = user_id);

create policy "study_sessions_insert_own"
  on study_sessions for insert
  with check (auth.uid() = user_id);
```

`focus_score`는 `round(집중 틱 수 / 전체 틱 수 * 100)`. `timeline`은 세션을 1분 단위로 나눠 각 구간의 집중 비율을 담는다 — 리포트 화면의 시간대별 그래프가 이 배열을 그대로 그린다.

## 집중도 판정 로직

새 모듈 `src/lib/focusTracker.js`가 캡처 세션의 시작/종료와 틱 집계를 담당한다.

- **입력**: `<video>` 엘리먼트(웹캠 스트림이 연결된), 5초 인터벌
- **매 틱마다**:
  - `faceLandmarker.detectForVideo(videoEl, timestamp)` 호출
  - `faceLandmarks.length === 0` (얼굴 미검출) **또는** `facialTransformationMatrixes`에서 계산한 yaw/pitch가 임계값 초과 → 비집중 틱
  - 그 외 → 집중 틱
- **세션 종료 시**: 누적된 틱 배열을 1분 버킷으로 묶어 `timeline` 생성, 전체 비율로 `focus_score` 계산
- 틱 집계·점수 계산 로직은 MediaPipe 호출과 분리된 순수 함수로 작성 — MediaPipe 없이도 단위 테스트 가능

## 프론트엔드 변경

### 신규 파일
- `src/components/StartLearning.js` / `.css` — 실시간 학습 세션 화면
- `src/lib/focusTracker.js` — 집중도 판정 로직 (위 섹션)
- `supabase/migrations/<timestamp>_create_study_sessions.sql`

### 신규 의존성
- `@mediapipe/tasks-vision` (npm 패키지 추가)

### 수정 파일

**`src/App.js`**
- `/start-learning` 라우트 신규 등록 (`StartLearning`)
- `/save_report`, `/report_a` 라우트 및 관련 import 제거

**`src/components/Save.js`** (기존 "학습 기록" — "학습 리포트"와 통합되어 세션 목록 역할)
- Figma 스캐폴드 전체 제거, 실제 구현으로 교체
- 마운트 시 `study_sessions`를 `user_id`로 조회, `started_at` 최신순 정렬
- 목록 각 행: 날짜, 지속시간, `focus_score` — 클릭 시 `/read?session=<id>`로 이동
- 데이터 없을 때 빈 상태 문구 (Mypage 패턴과 동일하게 mock 없이 정직하게)

**`src/components/Read.js`** (세션 상세 = 리포트)
- Figma 스캐폴드 전체 제거
- URL의 세션 id로 해당 `study_sessions` row 조회 (RLS로 본인 것만 조회됨)
- 종합 점수 + `timeline` 기반 1분 단위 집중도 바 그래프 (SVG 직접 구현, 차트 라이브러리 추가 안 함)

**`src/components/Mypage.js`**
- "최근 리포트" `<section>` 제거 (최근 기록과 중복이던 데이터)
- `QUICK_ACTIONS`에서 "학습 리포트" 항목 제거
- "학습 시작" 액션의 `path`를 `/start-learning`으로 연결 (기존엔 미등록 라우트였음)
- "최근 기록" 섹션의 전체보기 버튼은 그대로 `/save` 유지

### 폐기
- `src/components/Save_report.js`, `Report_a.js`와 대응 `.css` 삭제 — 기능이 `/save` + `/read`로 흡수됨

## 화면 흐름

1. Mypage → "학습 시작" 클릭 → `/start-learning`
2. 캠 권한 요청 → 거부 시 안내 메시지 + 재시도 버튼 (인라인, `role="alert"`)
3. 허용 시 웹캠 미리보기 + 경과 시간 타이머 + 실시간 상태 점(Mypage의 status-dot과 같은 시각 언어로 집중/비집중 표시)
4. 사용자가 "종료" 버튼 클릭 → `focusTracker` 결과 집계 → `study_sessions`에 insert
5. 저장 성공 시 `/read?session=<새 id>`로 이동해 리포트 바로 확인

## 에러 처리

- 캠 권한 거부: 얼럿 대신 인라인 에러 메시지 + 재시도 버튼
- 세션 중 얼굴 미검출 지속: 에러 아님 — 비집중으로 정상 집계
- 저장 실패(네트워크 등): 집계된 세션 데이터를 컴포넌트 state에 유지한 채 재시도 유도, 데이터 유실 방지
- MediaPipe 모델 로드 실패(CDN 문제 등): 안내 메시지 + 재시도, 세션 시작 자체를 막음

## 범위 밖 (명시적 제외)

- 웹캠 녹화 영상 저장/재생 — 이번엔 집중도 데이터만 저장, 영상 없음
- 휴지통(삭제·복원), AI 채팅 — 별도 서브프로젝트
- 고정 타이머/뽀모도로 모드 — 수동 종료만 지원
- 주간/월간 집계 리포트 — 세션 단위 리포트만
- 여러 얼굴 동시 감지, 다중 사용자 세션

## 검증

- 캠 권한 허용 후 실제로 얼굴을 화면 밖으로 돌렸을 때 비집중 틱이 쌓이는지 콘솔/state로 확인
- 세션 종료 후 Supabase 대시보드에서 `study_sessions`에 row가 실제로 insert되는지 확인
- `/save`에서 방금 만든 세션이 목록에 뜨는지, 클릭 시 `/read`에서 올바른 점수·그래프가 보이는지 확인
- 다른 사용자 계정으로 로그인했을 때 RLS로 서로의 세션이 안 보이는지 확인
- Mypage "학습 시작" 버튼이 `/start-learning`으로 정상 이동하는지, "최근 기록"에 방금 세션이 반영되는지 확인
- `npm run build` 컴파일 성공 확인
