# API 계약 — Edge Functions

Zoner의 서버 코드는 Supabase Edge Function 2개가 전부다.
**둘 다 존재 이유가 같다 — Anthropic API 키를 브라우저에 두지 않기 위해서.**

| 함수 | 하는 일 | 응답 형태 |
|---|---|---|
| `ai-chat` | AI 튜터 채팅. 메시지 저장 + 모델 응답 스트리밍 | SSE (`text/event-stream`) |
| `report-insight` | 세션 리포트의 조언 문단 생성 | JSON |

베이스 URL은 `{SUPABASE_URL}/functions/v1/`이다. `SUPABASE_URL`은
`REACT_APP_SUPABASE_URL` 환경변수로 주입되고, 저장소에 값이 들어 있지 않다.

---

## 공통 사항

### 인증

```
Authorization: Bearer <supabase access token>
```

**토큰은 헤더로만 보낸다.** 쿼리 파라미터에 실으면 액세스 로그와 리퍼러에 남는다.

두 함수 모두 같은 순서로 처리한다.

1. 헤더에서 JWT를 꺼낸다
2. `supabase.auth.getUser(jwt)`로 검증하고 `user.id`를 얻는다
3. 실패하면 `401`

> **함수 안의 Supabase 클라이언트는 `SUPABASE_SERVICE_ROLE_KEY`로 만든다 = RLS를 우회한다.**
> 따라서 소유권 확인을 코드가 직접 해야 한다. `ai-chat`이 대화 소유자를 명시적으로
> 비교하는 이유가 이것이다. 브라우저가 직접 DB를 읽을 때는 RLS가 막지만, 이 경로에서는 막지 않는다.

### CORS

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type
```

`OPTIONS` 요청에는 본문 `ok`와 위 헤더만 돌려준다.

`Allow-Origin: *`이지만 인증 없이는 아무것도 못 한다 — 유효한 Supabase JWT가 있어야
`401`을 넘어간다. 오리진을 좁히는 것은 실서비스 전환 시의 과제로 남겨 뒀다.

### 환경변수 (함수 측)

| 이름 | 용도 |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic Messages API 호출 |
| `SUPABASE_URL` | 함수 내부 DB 접근 |
| `SUPABASE_SERVICE_ROLE_KEY` | 〃 (RLS 우회) |

`ANTHROPIC_API_KEY`는 `supabase secrets set`으로 등록한다. 이름을 한 글자 틀려
(`ANTROPIC_API_KEY`) 채팅이 항상 502를 내던 적이 있다 (TROUBLESHOOTING.md TS-004).

### 모델

두 함수 모두 `claude-haiku-4-5-20251001`, `anthropic-version: 2023-06-01`을 쓴다.

| | `ai-chat` | `report-insight` |
|---|---|---|
| `max_tokens` | 1024 | 700 |
| `stream` | `true` | `false` |

상위 모델을 쓰지 않았다. **수치 계산은 앱이 하고 모델은 문장만 쓰기 때문**에
추론 난도가 낮고, 응답 속도와 비용이 더 중요했다.

---

## POST /functions/v1/ai-chat

사용자 메시지를 저장하고, 대화 맥락을 붙여 모델 응답을 스트리밍한다.
응답 스트림이 끝나면 assistant 메시지도 저장한다.

### 요청

```jsonc
{
  "content": "이차방정식 근의 공식이 왜 저렇게 나오는지 설명해줘",
  "conversationId": "3f2c9b41-0000-4000-8000-000000000001"
}
```

| 필드 | 타입 | 제약 |
|---|---|---|
| `content` | string | trim 후 1자 이상 **4000자 이하** |
| `conversationId` | string | UUID 형식. **필수** |

`conversationId`가 없거나 형식이 틀리면 **조용히 기본 대화에 쓰지 않고 거절한다.**
"어딘가에는 저장됐겠지"가 되는 것보다 명확히 실패하는 편이 낫다.

### 성공 응답 — `200 text/event-stream`

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

프레임은 세 종류다. 빈 줄 두 개(`\n\n`)로 구분된다.

```
data: {"text":"근의 공식은 "}

data: {"text":"완전제곱식으로 "}

data: [DONE]
```

| 프레임 | 의미 | 클라이언트 동작 |
|---|---|---|
| `data: {"text": "…"}` | 응답 조각 | 화면에 이어 붙인다 |
| `data: {"error": "…"}` | 스트림 도중 모델 오류 | 즉시 중단하고 메시지를 띄운다 |
| `data: [DONE]` | 정상 종료 | 스트림을 닫는다 |

파싱은 `src/lib/aiChat.js`의 `parseChatStreamLine()` 하나로 모이고,
`src/lib/aiChat.test.js`가 세 프레임의 계약을 고정한다.

**HTTP 상태는 200이지만 대화가 실패할 수 있다.** 스트림이 시작된 뒤의 오류는
상태 코드로 표현할 방법이 없어서 `error` 프레임으로 내려간다. 이 경우 assistant 메시지는 저장하지 않는다.

### 에러 응답 — `application/json`

```jsonc
{ "error": "오늘 사용 가능한 메시지 횟수를 다 썼어요. 내일 다시 이용해주세요." }
```

| HTTP | 조건 | `error` 본문 |
|---|---|---|
| `400` | 본문이 JSON이 아님 | `잘못된 요청입니다.` |
| `400` | `content`가 비었거나 4000자 초과 | `메시지 길이가 올바르지 않습니다.` |
| `400` | `conversationId`가 UUID 형식이 아님 | `대화를 찾을 수 없습니다.` |
| `401` | JWT 없음·만료·검증 실패 | `인증이 필요합니다.` |
| `404` | 대화가 없거나 **남의 대화** | `대화를 찾을 수 없습니다.` |
| `429` | 오늘 사용자 메시지 30건 도달 | `오늘 사용 가능한 메시지 횟수를 다 썼어요…` |
| `500` | DB 조회·삽입 실패, 예상 못 한 예외 | `요청을 처리하지 못했습니다.` |
| `502` | Anthropic 호출 실패 | `AI 응답을 받지 못했습니다.` |

**404가 두 경우를 같은 응답으로 덮는 것은 의도다.** "없는 대화"와 "남의 대화"를
다르게 응답하면 UUID를 넣어 보는 것만으로 대화의 존재 여부를 알아낼 수 있다.

클라이언트는 `src/lib/aiChat.js`에서 상태 코드별로 플래그를 붙여 던진다.

| 상태 | 플래그 | 화면 처리 |
|---|---|---|
| `429` | `error.isDailyLimit` | 입력창을 잠그고 안내 |
| `401` | `error.isUnauthorized` | 재로그인 유도 |
| `400` · `404` | `error.isConversationGone` | 대화 목록 갱신 유도 |

### 처리 순서

```
1. JWT 검증                                      → 401
2. 본문 파싱 · content 길이 · conversationId 형식 → 400
3. 대화 소유권 확인 (service role이므로 코드가 직접) → 404
4. 오늘 사용량 카운트 (user_id, role='user')      → 429
5. 대화의 기존 메시지 수 세기  ← user 메시지 삽입 "전"이어야 한다
6. user 메시지 저장
7. conversations.updated_at 갱신 (+ 첫 메시지면 title)
8. 최근 20건 로드 → 선두 assistant 행 절삭
9. Anthropic 스트리밍 호출                        → 502
10. SSE 중계, 완료 후 assistant 메시지 저장
```

순서에 걸린 조건 세 가지를 적어 둔다.

**5번은 6번보다 먼저여야 한다.** 제목 자동 생성 여부를 "이 대화의 첫 메시지인가"로
판단하는데, 방금 넣은 메시지를 세면 항상 1이 나와 영원히 첫 메시지가 아니게 된다.

**8번의 선두 절삭이 필요하다.** Anthropic Messages API는 첫 메시지가 `user`여야 한다.
최근 20건 윈도우가 `assistant` 행에서 시작하는 경우가 생기므로 앞에서부터 잘라낸다.

**7번의 실패는 답변을 막지 않는다.** 제목·정렬 갱신이 실패해도 메시지는 이미 저장됐고,
사용자에게 필요한 것은 답변이다. 로그만 남기고 진행한다.

또 하나 — **맥락을 `conversation_id`로 좁힌다.** `user_id`로 로드하면 화면에서만 방이
나뉘고 모델은 여전히 전 과목을 섞어 읽는다. 소유권은 3번에서 이미 확인했다.

### 일일 제한

| 항목 | 값 |
|---|---|
| 한도 | 사용자당 **30건/일** |
| 세는 대상 | `role = 'user'` 메시지만 (assistant 응답은 제외) |
| 기준 시각 | **KST 자정** (`startOfTodayKST()`가 UTC 오프셋 +9로 계산) |

**대화 단위가 아니라 사용자 단위다.** 대화 단위로 걸면 방을 새로 만들어 우회할 수 있다.
`(user_id, created_at)` 인덱스가 이 카운트를 받는다.

### 제목 자동 생성

첫 메시지를 보낼 때 대화 제목을 그 내용으로 바꾼다.

| 입력 | 제목 |
|---|---|
| 공백뿐 | `새 대화` |
| 20자 이하 | 공백 정규화한 원문 |
| 20자 초과 | 앞 20자 + `…` |

> ⚠️ 이 함수에는 `src/lib/conversations.js`의 `buildConversationTitle()`과 **같은 구현이 복제돼 있다.**
> Deno 런타임이라 그 파일을 import 할 수 없다.
> `src/lib/conversations.test.js`가 동작 계약을 고정하므로, 한쪽을 고치면 다른 쪽도 고쳐야 한다.
> 같은 이유로 `report-insight`에는 `formatTimeSlot()`이 복제돼 있다. 알고 진 부채다.

---

## POST /functions/v1/report-insight

세션 지표를 받아 조언 문장 배열을 돌려준다. 스트리밍하지 않는다.

### 요청

```jsonc
{
  "session": {
    "durationSeconds": 3600,
    "focusScore": 74,
    "netFocusSeconds": 2664,
    "longestStreakMinutes": 12,
    "firstBreakMinute": 9,
    "firstHalf": 81,
    "secondHalf": 67,
    "volatility": 14.2,
    "alertsPerHour": 5,
    "topDistraction": { "reason": "head_turned", "ratio": 18 }
  },
  "profile": {
    "sessionCount": 12,
    "averageScore": 71,
    "rhythmType": "early",
    "distractionType": "head_turned",
    "enduranceMinutes": 11,
    "trend": "up",
    "bestSlot": 42,
    "bestWeekday": 2
  }
}
```

`session`은 필수, `profile`은 `null`을 허용한다.
**표본이 모자라면 클라이언트가 아예 보내지 않는다** (`profile.hasEnoughData`가 거짓일 때).
근거가 약한 값을 주면 모델은 그걸로 단정적인 문장을 만든다.

`buildInsightPayload()`(`src/lib/reportInsight.js`)가 세션 객체를 통째로 넘기지 않고
**필요한 숫자만 옮겨 담는다.** DB 컬럼이 늘어도 자동으로 따라 나가지 않게 하기 위해서다.

#### 허용 값

| 필드 | 허용 값 |
|---|---|
| `topDistraction.reason`, `profile.distractionType` | `focused` · `looking_down` · `head_turned` · `looking_up` · `eyes_closed` · `absent` |
| `profile.rhythmType` | `early` · `late` · `steady` · `volatile` |
| `profile.trend` | `up` · `flat` · `down` |
| `profile.bestSlot` | 정수 `0`~`47` (30분 단위 슬롯). `42` → `21:00~21:30` |
| `profile.bestWeekday` | 정수 `0`(일)~`6`(토) |
| 그 외 수치 | 유한한 숫자만. `NaN`·`Infinity`·문자열은 버린다 |

**이 검증이 이 함수의 핵심이다.** 들어온 본문은 클라이언트가 보낸 것이므로 신뢰하지 않는다.

- 숫자는 `Number()`로 강제 변환하고 `Number.isFinite()`를 통과한 것만 쓴다
- 라벨은 위 허용 목록에 있는 것만 쓴다
- 통과하지 못한 필드는 **프롬프트 줄 자체를 만들지 않는다**

그대로 이어붙이면 조작된 클라이언트가 프롬프트에 지시문을 심을 수 있다.
허용 목록 방식이면 심을 수 있는 것이 `head_turned` 같은 상수 6개뿐이다.

### 성공 응답 — `200 application/json`

```jsonc
{
  "advice": [
    "후반 집중도가 전반보다 14%p 낮았습니다. 40분쯤에 5분 쉬어 보세요.",
    "이탈 원인의 18%가 고개 돌림이었습니다. 화면 옆 물건을 치워 보세요."
  ]
}
```

| 항목 | 값 |
|---|---|
| `advice` | 문자열 배열. **최대 4개** (초과분은 잘라낸다) |
| 각 항목 | 2문장 이내. 관찰 + 행동을 함께 담는다 |

클라이언트도 4개로 다시 자르고 빈 문자열을 거른다. 서버가 이미 자르지만
**응답 형태를 신뢰하지 않는 쪽**이 맞다 — `advice`가 배열이 아니면 던진다.

### 에러 응답

| HTTP | 조건 | `error` 본문 |
|---|---|---|
| `400` | 본문이 JSON이 아님 | `잘못된 요청입니다.` |
| `400` | 검증을 통과한 세션 지표가 **하나도 없음** | `분석할 수치가 없습니다.` |
| `401` | JWT 없음·만료·검증 실패 | `인증이 필요합니다.` |
| `500` | 예상 못 한 예외 | `조언을 만들지 못했습니다.` |
| `502` | Anthropic 호출 실패 | `조언을 만들지 못했습니다.` |

**실패해도 리포트는 죽지 않는다.** 클라이언트는 조언 섹션만 접고 나머지 지표는 그대로 보여준다.
AI는 리포트의 부가 요소이지 전제가 아니다.

### 모델 출력 파싱

시스템 프롬프트는 "JSON 배열 하나만, 코드펜스 없이"를 지시하지만 지켜지지 않을 수 있다.
`parseAdvice()`가 2단으로 받는다.

1. 정규식 `/\[[\s\S]*\]/`로 **첫 JSON 배열만** 떼어내 파싱하고, 문자열 항목만 남긴다
2. 실패하면 줄 단위로 쪼개고 앞의 `-`·`*`·번호·따옴표와 뒤의 `",`를 벗겨낸다

모델이 코드펜스를 붙이거나 배열 앞뒤에 말을 덧붙여도 조언은 나온다.

### 프롬프트 규칙

시스템 프롬프트가 못박은 것.

- 주어진 수치만 근거로 삼는다. 없는 데이터를 지어내지 않는다
- **수치를 다시 계산하거나 고치지 않는다. 인용만 한다**
- 조언 4개 이하, 각 2문장 이내. 관찰 + 행동
- "열심히 하세요" 같은 일반론 금지. 이 사람의 수치에서만 나올 수 있는 말
- 평가·훈계하지 않는다
- **의학적 진단(수면장애, ADHD 등)을 내리지 않는다**

> ⚠️ 프롬프트에 박힌 `WARMUP_MINUTES = 2`는 `src/lib/sessionMetrics.js`와 **같은 값이어야 한다.**
> 지표의 정의를 잘못 설명하면 모델이 틀린 전제로 조언을 쓴다.
> 마찬가지로 `REASONS` 배열은 `src/lib/focusTracker.js`의 `REASON`과 1:1이다.

---

## 자체 API 규약과 다른 점

이 프로젝트의 표준(`~/.claude/standards/api-contract.md`)은 모든 응답에
`{ success, data, error }` 봉투와 `AUTH_TOKEN_EXPIRED` 형태의 에러 코드를 요구한다.
**두 함수 모두 이 규약을 따르지 않는다.** 있는 그대로 적는다.

| 규약 | 실제 |
|---|---|
| `{ success, data, error }` 봉투 | 성공은 `{ advice: [...] }` / SSE, 실패는 `{ error: "…" }` |
| 에러 `code`로 분기 | HTTP **상태 코드**로 분기 (`aiChat.js`가 429/401/400·404를 나눔) |
| 사람이 읽는 `message`는 참고용 | `error` 값이 그대로 화면 문구 |

엔드포인트가 2개이고 클라이언트가 하나뿐인 규모에서, 봉투를 씌워도 얻는 것이
"`response.ok` 대신 `body.success`를 본다" 정도였다. 대신 **분기 가능한 축은
상태 코드로 확실히 나눠 뒀다** — 429·401·404가 화면에서 각각 다르게 처리된다.

엔드포인트가 늘거나 클라이언트가 둘 이상이 되면 이 판단은 뒤집혀야 한다.
그때는 문구가 아니라 코드로 분기해야 하고, 봉투 없이는 그게 안 된다.

---

## 로컬에서 배포하기

```bash
supabase functions deploy ai-chat
supabase functions deploy report-insight
supabase secrets set ANTHROPIC_API_KEY=<key>
```

`SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`는 Supabase가 자동으로 주입한다.

---

## 관련 문서

- [DATABASE.md](DATABASE.md) — 이 함수들이 읽고 쓰는 테이블
- [adr/002-rls-authorization.md](adr/002-rls-authorization.md) — 왜 이 함수들만 권한을 코드로 확인하는가
- [adr/README.md](adr/README.md) — 의사결정 기록 전체
