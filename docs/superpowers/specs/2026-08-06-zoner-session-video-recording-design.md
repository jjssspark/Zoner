# 학습 영상 녹화·저장·재생 설계

**작성일:** 2026-08-06
**상태:** 승인 대기

## 목표

학습 세션을 웹캠으로 녹화해 두고, 리포트 화면에서 다시 볼 수 있게 한다. 단순 재생에 그치지 않고 리포트의 알림 기록과 집중도 그래프를 눌러 해당 장면으로 바로 건너뛸 수 있어야 한다.

## 이 스펙의 위치

영상 저장은 앞선 두 스펙에서 의도적으로 미뤄둔 작업이다. 이번이 그 후속이다.

- `2026-08-04-zoner-focus-session-pipeline-design.md:115` — "웹캠 녹화 영상 저장/재생 — 이번엔 집중도 데이터만 저장, 영상 없음"
- `2026-08-05-zoner-realtime-focus-alerts-design.md:14` — "영상 저장·재생은 스토리지 용량과 비용이 걸린 별개 규모의 작업으로, 필요해지면 독립 스펙으로 다룬다"

같은 대화에서 함께 요청된 **서비스 3개 화면**과 **리포트 지표 확충 + AI 학습 팁**은 이 스펙에 넣지 않는다. 서로 독립된 subsystem이고 결정해야 할 것이 완전히 다르므로 각각 별도 스펙으로 다룬다.

## 범위 밖

이번 작업에서 하지 않는 것을 먼저 못박는다.

- **휴지통 영구삭제 장치** — 현재 휴지통은 "N일 후 자동 삭제" 문구만 있고 실제 삭제 코드가 없다. 이번 작업이 그 기능을 새로 만들 이유가 없다. 휴지통에 있는 영상도 용량은 실제로 차지하므로 저장 한도 계산에는 **포함**하되, 자동 삭제는 만들지 않는다.
- **오디오 녹음** — 현재 `getUserMedia({ video: true })`는 마이크 권한을 요구하지 않는다. 소리를 넣으면 권한 분기가 늘고 용량이 커진다. 다시 볼 때 필요한 정보는 자세와 자리 유무이지 소리가 아니다.
- **녹화 길이 상한** — 개수 제한만 둔다. 긴 세션의 메모리 문제는 "알려진 한계"에 기록한다.
- **요금제 연동** — 한도는 상수 3으로 고정한다. 플랜별 분기는 요금제 화면 작업에서 다룬다.

## 결정 사항 요약

| 항목 | 결정 |
|---|---|
| 저장 위치 | Supabase Storage (비공개 버킷) |
| 녹화 시작 | 학습 시작 시 자동, 메모리에만 보관 |
| 저장 확정 | 종료할 때 사용자가 선택 |
| 한도 | 계정당 3개. 초과 시 가장 오래된 것을 지우거나 이번 저장을 포기 |
| 오디오 | 없음 |
| 재생 진입점 | 목록에서 처음부터 / 알림 기록 클릭 / 집중도 그래프 클릭 |

---

## 1. 아키텍처

순수 로직은 `src/lib/`에 둔다. 이 저장소의 Jest는 `react-router-dom`을 import하는 파일을 로드하지 못하므로(TS-003), 테스트하려는 로직은 화면 파일 밖에 있어야 한다.

| 파일 | 책임 | 신규/수정 |
|---|---|---|
| `src/lib/sessionRecorder.js` | MediaRecorder 래핑. 상태 전이와 Blob 생성 | 신규 |
| `src/lib/sessionVideos.js` | 저장 경로, 한도 판정, 삭제 대상 선정 | 신규 |
| `src/lib/alertEngine.js` | 알림에 `offset_seconds` 부여 | 수정 |
| `src/lib/focusTracker.js` | timeline 버킷을 경과 시간 기준으로 | 수정 |
| `src/components/StartLearning.js` | 녹화 제어, 종료 시 업로드 | 수정 |
| `src/components/Read.js` | 영상 재생, seek 연동 | 수정 |
| `src/components/SessionReport.css` | 영상 섹션 스타일 | 수정 |

의존 방향은 화면 → lib 한 방향이다. `lib/`끼리는 서로 import하지 않는다.

---

## 2. 시각 정렬 — 기존 동작 변경

**이 절이 이번 설계에서 가장 중요하다.** 여기가 틀리면 클릭했을 때 엉뚱한 장면이 나오고, 그건 기능이 없느니만 못하다.

### 문제

일시정지하면 `MediaRecorder.pause()`가 그 구간을 영상에서 들어낸다. 따라서 완성된 영상의 재생 시간축은 **일시정지를 제외한 순수 학습 시간**이다.

그런데 현재 코드의 시각 기준은 벽시계다.

- `focusTracker.js:155` — timeline 버킷을 `Math.floor((tick.timestampMs - startMs) / 60000)`으로 계산한다
- `alertEngine.js` — 알림을 `started_at` ISO 문자열로 저장한다

10분 쉬었다 오면 그래프에는 빈 10분이 생기고, 영상에는 그 10분이 없다. 그래프 12분 지점을 눌러도 영상은 2분 지점이 맞다. 어긋난다.

부수적으로, 이건 영상과 무관하게 **이미 존재하는 버그**다. 일시정지가 긴 세션의 그래프에는 지금도 빈 구간이 생기고 있다.

### 해결

틱마다 경과 시간(`elapsedMs` — 일시정지 제외 누적)을 함께 싣고, timeline과 알림 오프셋 모두 이 값을 기준으로 삼는다.

`createFocusTracker`의 시그니처는 바꾸지 않는다. 경과 시간을 아는 주체는 `StartLearning`이므로, `onTick` 핸들러가 틱에 `elapsedMs`를 붙여 저장소와 알림 엔진에 넘긴다.

```js
// StartLearning.js — onTick 핸들러
const elapsedMs =
  accumulatedMsRef.current +
  (segmentStartedAtRef.current === null
    ? 0
    : Date.now() - segmentStartedAtRef.current);

const enrichedTick = { ...tick, elapsedMs };
ticksRef.current.push(enrichedTick);
alertEngineRef.current.handleTick(enrichedTick);
```

### 하위호환

기존에 저장된 세션의 `alerts[]`에는 `offset_seconds`가 없다. 그 세션은 영상도 없으므로(이번 기능 이전 데이터) 문제되지 않지만, 방어적으로 `offset_seconds`가 없는 알림 행은 클릭 불가로 렌더한다.

기존 `timeline`은 벽시계 기준으로 저장돼 있다. 이미 저장된 값을 소급해 고치지 않는다 — 그 세션들에는 영상이 없으므로 어긋날 대상이 없다.

---

## 3. 녹화

### 카메라는 새로 열지 않는다

`StartLearning`이 이미 확보한 `streamRef.current`를 그대로 `MediaRecorder`에 물린다. `getUserMedia`를 다시 호출하지 않는다 — 두 번 열면 TS-002·TS-009 계열의 스트림 수명 문제가 재발한다.

`getUserMedia({ video: true })` 제약도 바꾸지 않는다. 해상도는 카메라가 주는 대로 따르고, 용량은 비트레이트로 잡는다. 제약을 바꾸면 미리보기와 MediaPipe 판정에 동시에 영향이 가는데, 지금 잘 도는 코드를 영상 때문에 건드릴 이유가 없다.

### 파라미터

```js
export const RECORDER_MIME_TYPE = 'video/webm;codecs=vp8';
export const RECORDER_VIDEO_BITS_PER_SECOND = 400000;
export const RECORDER_TIMESLICE_MS = 1000;
```

400kbps 기준 45분이 약 135MB다. 3개면 약 400MB로 무료 티어 1GB 안에 들어온다.

`timeslice`를 1초로 주는 이유는 청크가 점진적으로 쌓이게 하기 위해서다. 주지 않으면 `stop()` 시점에 한 번에 인코딩되어 종료가 눈에 띄게 느려진다.

### 인터페이스

```js
export function isRecordingSupported() // boolean

export function createSessionRecorder({ stream, onError })
// → {
//     start(),                    // 녹화 시작
//     pause(),                    // 일시정지 (구간이 영상에서 빠진다)
//     resume(),                   // 재개
//     stop(): Promise<Blob|null>, // 종료. 청크가 없으면 null
//     isActive(): boolean,
//   }
```

`isRecordingSupported()`는 `typeof window.MediaRecorder === 'function'`과 `MediaRecorder.isTypeSupported(RECORDER_MIME_TYPE)`를 함께 본다. 둘 중 하나라도 아니면 녹화 없이 학습만 진행하고, 종료 시 저장 선택지를 아예 보여주지 않는다.

### 생명주기 연결

| 화면 동작 | 레코더 |
|---|---|
| `handleStart` | `start()` |
| `handlePause` | `pause()` |
| `handleResume` | `resume()` |
| `handleStop` | `stop()` → Blob |
| 언마운트 | `stop()` 후 Blob 폐기 |

`MediaRecorder.onerror`가 발생하면 녹화를 중단하고 `onError` 콜백으로 알린다. 화면은 "영상 녹화가 중단되었습니다" 안내를 띄우되 **학습 자체는 계속 진행한다.** 알림음과 같은 원칙이다 — 부가 기능 때문에 본 기능을 멈추지 않는다.

---

## 4. 저장 흐름

종료를 누르면 확인 다이얼로그를 띄운다. 기존 `src/components/ui/ConfirmDialog.js`를 재사용한다(포커스 트랩·Esc·포커스 복원이 이미 구현돼 있다).

### 한도에 여유가 있을 때

```
"영상도 함께 저장할까요?"
[영상과 함께 저장]  [기록만 저장]
```

### 한도가 찼을 때 (저장된 영상 3개)

```
"저장된 영상이 3개로 가득 찼습니다.
 가장 오래된 영상(8월 3일)을 지우고 저장할까요?"
[오래된 것 지우고 저장]  [기록만 저장]
```

### 순서

```
1. 세션 insert            → id 확보
2. (한도 초과 시) 가장 오래된 영상의 Storage 객체 삭제 + 그 행의 video_path를 null로
3. Storage 업로드          → {user_id}/{session_id}.webm
4. study_sessions update   → video_path 설정
5. /read?session={id} 이동
```

세션 insert를 먼저 하는 이유는 경로에 session id가 필요하기 때문이다. 이 순서의 부수 효과로 **업로드가 실패해도 학습 기록은 남는다.** 45분을 공부하고 업로드 한 번 실패했다고 기록까지 날리는 건 받아들일 수 없다.

3단계가 실패하면 4단계를 건너뛰고 "영상 저장에 실패했습니다. 학습 기록은 저장되었습니다"를 안내한 뒤 리포트로 이동한다. 재시도는 제공하지 않는다 — 화면을 떠나면 메모리의 Blob이 사라지므로 재시도할 대상이 없다.

2단계가 실패하면 업로드를 시도하지 않고 중단한다. 지우지 못한 채 올리면 한도를 넘는다.

### 업로드 진행 표시

업로드 중에는 종료 버튼을 비활성화하고 "영상 업로드 중..."을 표시한다. Supabase JS 클라이언트의 `upload()`는 진행률 콜백을 제공하지 않으므로 퍼센트는 표시하지 않는다. 없는 진행률을 지어내지 않는다.

---

## 5. 스토리지

### 버킷

- 이름: `session-videos`
- 공개 여부: **비공개**
- 경로 규칙: `{user_id}/{session_id}.webm`

경로 첫 세그먼트를 user_id로 두는 것이 RLS의 핵심이다. `storage.foldername(name)[1]`로 소유자를 판별한다.

### 정책

`storage.objects`에 4개 정책을 건다. 조건은 모두 동일하다.

```sql
bucket_id = 'session-videos'
and (storage.foldername(name))[1] = auth.uid()::text
```

- select — 재생용 signed URL 발급
- insert — 업로드
- update — upsert 경로
- delete — 한도 초과 시 오래된 것 정리

### 재생 URL

`createSignedUrl(path, 3600)`으로 1시간짜리 서명 URL을 받는다. 리포트를 여는 시점에 발급한다. 공개 URL을 쓰지 않는다 — 학습 영상은 얼굴이 담긴 개인 데이터다.

---

## 6. DB 마이그레이션

```sql
alter table study_sessions add column video_path text null;
```

### 뷰 재생성 — 빠뜨리면 TS-012 재발

`active_study_sessions` 뷰는 컬럼을 고정 나열한다(`20260805110000_pin_active_study_sessions_columns.sql`). 테이블에 컬럼을 추가해도 뷰를 갱신하지 않으면 화면에서 `column "video_path" does not exist`가 난다. TS-012가 정확히 이 실수였다.

`create or replace view`는 컬럼을 **뒤에 덧붙이는 것만** 가능하다. 이름 변경이나 순서 변경은 거부된다. 따라서 기존 순서를 그대로 두고 `video_path`를 맨 뒤에 붙인다.

현재 뷰 컬럼 순서(마이그레이션 이력 기준):

```
id, user_id, started_at, ended_at, duration_seconds,
focus_score, timeline, deleted_at, focus_breakdown, alerts
```

여기에 `video_path`를 추가해 11개가 된다.

### 마이그레이션 파일

| 파일 | 내용 |
|---|---|
| `20260806150000_add_video_path_to_study_sessions.sql` | 컬럼 추가 + 뷰 재생성 |
| `20260806160000_create_session_videos_bucket.sql` | 버킷 생성 + 정책 4개 |

버킷 생성은 `on conflict do nothing`으로 멱등하게 쓴다.

---

## 7. 재생 화면 (Read.js)

### 배치

영상 섹션은 집중도 점수 바로 다음, 시간대별 그래프보다 위에 둔다. `video_path`가 없으면 섹션 자체를 렌더하지 않는다 — 빈 껍데기나 "영상 없음" 문구를 두지 않는다.

### 구성

```
┌──────────────────────────────────────┐
│                                      │
│         [ video controls ]           │
│                                      │
└──────────────────────────────────────┘

시간대별 집중도
┌──────────────────────────────────────┐
│ ███░█████░░██████░████████            │
│       ▲ 재생 중 현재 위치             │
└──────────────────────────────────────┘
   ↑ 막대 클릭 → 해당 분으로 이동

알림 기록 (3건)
┌──────────────────────────────────────┐
│ ▶ 자리비움   03:12  53초              │  ← 클릭 → 03:12로 이동
│ ▶ 고개돌림   11:40  20초              │
└──────────────────────────────────────┘
```

### seek 동작

- 알림 행 클릭 → `videoRef.current.currentTime = alert.offset_seconds`
- 그래프 막대 클릭 → `videoRef.current.currentTime = bucket.minute * 60`
- `timeupdate` 이벤트 → 현재 위치를 그래프 마커로 표시

영상이 없는 세션에서는 알림 행과 그래프 막대를 **버튼이 아닌 일반 요소로 렌더한다.** 누를 수 없는 버튼을 보여주지 않는다.

### 접근성

- seek 진입점은 `<button>`으로 만든다. `div` + `onClick`을 쓰지 않는다
- 알림 버튼의 접근 이름: `"자리비움, 3분 12초 지점부터 재생"`
- 그래프 막대 버튼의 접근 이름: `"12분대, 집중도 40%, 이 지점부터 재생"`
- 현재 위치 마커는 색만으로 표시하지 않는다. 마커의 위치 자체가 정보이고, 재생 진행 상황은 `<video controls>`의 기본 컨트롤이 스크린리더에 전달한다
- 영상에는 `<track kind="captions">`를 붙이지 않는다 — 오디오가 없으므로 자막 대상이 없다

---

## 8. 에러 처리

| 상황 | 동작 |
|---|---|
| MediaRecorder 미지원 | 녹화 없이 학습 진행. 종료 시 저장 선택지를 보여주지 않음 |
| 녹화 중 `onerror` | 녹화 중단 + 안내. 학습은 계속 |
| 오래된 영상 삭제 실패 | 업로드 중단. "정리에 실패했습니다" 안내 후 기록만 저장 |
| 업로드 실패 | 세션은 저장됨. "영상 저장에 실패했습니다" 안내 후 리포트 이동 |
| signed URL 발급 실패 | 영상 섹션에만 "영상을 불러오지 못했습니다". 나머지 리포트는 정상 |
| 영상 파일이 Storage에 없음 | 위와 동일 처리 |

공통 원칙: **영상은 부가 기능이다. 어떤 실패도 학습 기록과 리포트를 막지 않는다.**

---

## 9. 테스트

### 단위 테스트 (Jest)

`sessionRecorder.test.js`
- 미지원 브라우저에서 `isRecordingSupported()`가 false
- `start` → `pause` → `resume` → `stop` 상태 전이
- `stop()`이 수집된 청크로 Blob을 만든다
- 청크가 없으면 `stop()`이 null을 반환한다
- `onerror` 발생 시 `onError` 콜백이 호출되고 예외가 밖으로 나가지 않는다

`sessionVideos.test.js`
- `buildVideoPath(userId, sessionId)` 경로 형식
- `isVideoLimitReached(count)` 경계값 (2·3·4)
- `pickOldestVideoSession(sessions)`가 `started_at` 오름차순 첫 번째를 고른다
- 영상 있는 세션이 없을 때 `pickOldestVideoSession`이 null

`alertEngine.test.js` (보강)
- 알림에 `offset_seconds`가 붙는다
- 일시정지로 `elapsedMs`가 멈춘 구간에서도 오프셋이 경과 시간을 따른다

`focusTracker.test.js` (보강)
- timeline 버킷이 `elapsedMs` 기준으로 계산된다
- 일시정지가 있는 틱 배열에서 빈 구간이 생기지 않는다

### 수동 검증 (브라우저)

화면 파일은 `react-router-dom` 때문에 Jest로 못 돈다(TS-003). 아래는 반드시 실제 브라우저에서 확인한다.

1. 학습 시작 → 30초 진행 → 종료 → "영상과 함께 저장" → 리포트에 영상이 뜨고 재생된다
2. 알림 기록을 클릭하면 해당 시점으로 이동한다
3. 그래프 막대를 클릭하면 해당 분으로 이동한다
4. 재생 중 그래프 마커가 따라 움직인다
5. **일시정지를 낀 세션**에서 알림 클릭 지점과 실제 장면이 일치한다 ← 2절의 핵심
6. "기록만 저장"을 고르면 영상 섹션이 없다
7. 영상 4개째를 저장할 때 한도 다이얼로그가 뜨고, 지우고 저장하면 개수가 3으로 유지된다
8. 기존 세션(영상 없음)의 리포트가 그대로 보인다

**정적 리뷰는 실행을 대체하지 못한다.** TS-010은 리뷰 3회를 통과한 코드가 브라우저에서 빈 화면이었던 건이다. 리뷰가 끝나도 반드시 직접 연다.

---

## 10. 알려진 한계

- **긴 세션의 메모리** — 청크를 메모리에 쌓으므로 3시간 세션은 약 540MB를 점유한다. 탭이 불안정해질 수 있다. 개수 제한만 두기로 했으므로 길이 상한은 없다. `onerror` 처리가 최후의 방어선이다.
- **업로드 진행률 없음** — Supabase JS `upload()`가 진행률을 주지 않는다. 큰 영상은 표시 없이 기다리게 된다.
- **재시도 없음** — 업로드 실패 시 Blob이 화면과 함께 사라진다.
- **휴지통 영상이 정리되지 않음** — 한도에는 포함되지만 자동 삭제 장치가 없다. 휴지통을 비우는 기능이 생길 때 함께 다뤄야 한다.
- **기존 세션의 timeline은 벽시계 기준** — 소급 수정하지 않는다. 그 세션들에는 영상이 없어 어긋날 대상이 없다.

---

## 11. 전역 제약

- 디자인 토큰은 `src/styles/tokens.css`의 **의미 토큰만** 쓴다. 새 토큰을 만들지 않는다. 하드코딩된 색을 쓰지 않는다.
- 상단바는 모든 화면에서 sticky 고정이 기본이다.
- 테스트: `CI=true npx react-scripts test --watchAll=false`. 현재 기준선은 12스위트 139건.
- 빌드: `npx react-scripts build`. **`CI=true`를 붙이지 않는다** — `UserGuide.js`의 기존 jsx-a11y 경고 3건이 에러로 승격돼 실패한다.
- 커밋 메시지에 attribution 푸터(`Co-Authored-By` 등)를 붙이지 않는다.
- 트러블슈팅은 건별로 해결·검증 직후 `docs/TROUBLESHOOTING.md`에 기록한다. 마지막 번호는 TS-012다.
