# TabMind

**Gemini AI 기반 Chrome 탭 그룹화 확장 프로그램**

TabMind는 브라우저에 열려 있는 여러 탭을 사용자의 자연어 요청에 따라 분석하고, 목적별로 그룹화할 수 있도록 도와주는 Chrome Extension입니다.

AI가 제안한 그룹 구성을 사용자가 직접 확인하고 수정한 뒤 적용할 수 있으며, 마지막 정리 작업을 되돌리는 기능도 제공합니다.

## 주요 기능

- **AI 탭 그룹 추천**: Gemini API를 활용해 탭 제목과 URL을 분석하고 사용 목적에 따라 그룹 추천
- **자연어 정리 요청**: "채용공고는 회사별로, 개발 문서는 기술별로 묶어줘"와 같이 원하는 정리 방식 입력
- **분석 대상 선택**: 정리할 탭을 체크박스로 직접 선택
- **그룹 미리보기 및 수정**: 추천된 그룹 이름을 변경하거나 탭을 다른 그룹으로 이동
- **탭 그룹 자동 생성**: Chrome Tab Groups API를 활용해 그룹 생성
- **마지막 정리 되돌리기**: 정리 전 탭 그룹 및 순서 복원 시도
- **서버 실행 방식 선택**: Local FastAPI 또는 인증된 Render 서버 사용

## 기술 스택

| 구분 | 기술 |
|---|---|
| Chrome Extension | JavaScript, HTML, CSS, Manifest V3 |
| Backend | Python, FastAPI, Uvicorn |
| AI | Google Gemini API |
| Deployment | Render |
| CI | GitHub Actions |
| Storage | Chrome Storage API |

## 시스템 아키텍처

```text
                  Chrome Extension
                         │
                 사용자 정리 요청
                         │
                         ▼
                  서버 모드 선택
                         │
             ┌───────────┴───────────┐
             │                       │
             ▼                       ▼
      Local FastAPI             Render FastAPI
      127.0.0.1:8765           개인 인증 필요
             │                       │
      사용자 API 키              배포자 API 키
             │                       │
             └───────────┬───────────┘
                         │
                         ▼
                     Gemini API
                         │
                  그룹 추천 JSON
                         │
                         ▼
                  Chrome Extension
                         │
                 미리보기 및 수정
                         │
                         ▼
                Chrome Tab Groups API
```

Chrome Extension은 선택한 탭의 제목, URL 및 사용자 정리 요청을 FastAPI 서버에 전송합니다.

FastAPI는 Gemini API를 호출해 그룹 추천 결과를 생성하고, 탭 ID의 누락 및 중복 여부를 검증합니다.

사용자가 정리안을 확인하고 적용하면 Chrome Tab Groups API를 통해 실제 탭 그룹을 생성합니다.

## 설치 및 실행

### 1. 프로젝트 Clone

```bash
git clone https://github.com/kaeuni/tabmind.git
cd tabmind
```

### 2. Python 의존성 설치

Python 3.13 환경을 기준으로 작성되었습니다.

```bash
cd backend

python -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
```

Windows에서는 가상환경 활성화 명령어가 다를 수 있습니다.

### 3. Gemini API 키 설정

`backend/.env.example`을 복사해 `.env` 파일을 생성합니다.

```bash
cp .env.example .env
```

`.env` 파일에 본인의 Gemini API 키를 입력합니다.

```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=gemini-3.5-flash-lite
```

Gemini API 키는 [Google AI Studio](https://aistudio.google.com/apikey)에서 발급받을 수 있습니다.

### 4. FastAPI 서버 실행

`backend` 디렉터리에서 실행합니다.

```bash
python -m uvicorn app:app --host 127.0.0.1 --port 8765
```

정상적으로 실행되면 다음 주소에서 API 문서를 확인할 수 있습니다.

```text
http://127.0.0.1:8765/docs
```

### 5. Chrome Extension 설치

1. Chrome 주소창에 `chrome://extensions` 입력
2. 오른쪽 상단의 **개발자 모드** 활성화
3. **압축해제된 확장 프로그램을 로드합니다** 선택
4. 프로젝트의 `extension` 폴더 선택
5. Chrome 도구 모음에서 TabMind 실행

### 6. 서버 설정

TabMind의 **AI 서버 설정**에서 `Local (내 컴퓨터)`를 선택하고 저장합니다.

이후 분석할 탭을 선택하고 AI 정리 요청을 입력하면 됩니다.

로컬 모드에서는 자신의 컴퓨터에서 FastAPI 서버가 실행 중이어야 합니다.

## Render 배포 (선택 사항)

TabMind는 FastAPI를 Render에 배포해 로컬 서버를 직접 실행하지 않고 사용할 수도 있습니다.

현재 프로젝트의 Render 설정은 **개인 사용을 위한 인증 방식**을 기준으로 구성되어 있습니다.

### Render Web Service 설정

| 항목 | 설정 |
|---|---|
| Language | Python |
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app:app --host 0.0.0.0 --port $PORT` |

### Environment Variables

| Key | Value |
|---|---|
| `APP_ENV` | `production` |
| `GEMINI_API_KEY` | 본인의 Gemini API 키 |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` |
| `TABMIND_ACCESS_TOKEN` | 개인 인증 토큰 |

인증 토큰은 다음 명령어로 생성할 수 있습니다.

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

운영 환경에서는 `/suggest` API 호출 시 다음 인증 헤더가 필요합니다.

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```

인증 토큰은 GitHub 코드에 포함하지 않고 Chrome Extension 설정에서 직접 입력합니다.

**참고:** 현재 확장 프로그램의 Render 서버 주소는 프로젝트 배포자의 주소로 설정되어 있습니다. 다른 사용자가 자신의 Render 서버를 사용하려면 확장 프로그램의 서버 주소를 본인의 배포 주소로 변경해야 합니다.

## 보안 및 데이터 처리

TabMind는 다음 사항을 고려해 구현했습니다.

- Gemini API 키는 FastAPI 서버의 환경변수에서 관리합니다.
- 운영 환경에서는 Bearer 토큰으로 API 접근을 제한합니다.
- Chrome Extension에 입력한 인증 토큰은 `chrome.storage.local`에 저장됩니다.
- URL 전송 시 쿼리 문자열과 해시를 제외합니다.
- 일부 민감한 서비스 도메인은 분석 대상에서 제외합니다.
- AI가 반환한 그룹 결과에 탭 ID 누락 또는 중복이 있는지 검증합니다.
- 탭 그룹 적용 전 사용자가 결과를 검토할 수 있습니다.

**주의:** 선택한 탭의 제목과 URL 경로 및 정리 요청은 FastAPI 서버를 거쳐 Gemini API로 전송됩니다. URL 경로에도 민감한 정보가 포함될 수 있으므로 분석 대상을 확인해 주세요.

`chrome.storage.local`은 비밀정보 전용 보안 저장소가 아니므로 인증 토큰을 입력한 브라우저 프로필의 보안에도 주의해야 합니다.

## CI

GitHub Actions를 통해 `main` 브랜치에 Push하거나 Pull Request를 생성할 때 백엔드 검증 작업을 실행합니다.

현재 CI는 다음 작업을 수행합니다.

1. GitHub 저장소 Checkout
2. Python 3.13 환경 구성
3. 백엔드 의존성 설치
4. Python 코드 구문 검사 (`compileall`)

## 프로젝트 구조

```text
tabmind/
├── .github/
│   └── workflows/
│       └── ci.yml
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   └── .env.example
├── extension/
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── .gitignore
└── README.md
```

## 기술적 특징

**1. 자연어 기반 탭 분류**

사용자의 정리 요청과 선택한 탭 정보를 Gemini에 전달하고, JSON 형식의 그룹 추천 결과를 생성합니다.

**2. AI 응답 검증**

AI가 반환한 결과를 바로 적용하지 않고, 요청한 탭 ID가 정확히 한 번씩 포함되었는지 확인해 잘못된 그룹 구성을 방지합니다.

**3. 사용자 검토 후 적용**

AI의 추천 결과를 사용자가 수정할 수 있도록 하여 의도하지 않은 탭 정리를 줄입니다.

**4. 탭 그룹 복원**

정리 적용 직전의 탭 ID, 순서, 그룹 정보를 Chrome Storage에 저장하고 마지막 정리 작업을 되돌릴 수 있도록 구현했습니다.

단, 이미 닫힌 탭이나 Chrome의 탭 그룹 제약으로 인해 모든 상태가 완전히 복원되는 것은 아닙니다.

**5. 로컬 및 클라우드 실행 지원**

공개 저장소 사용자에게는 자신의 Gemini API 키를 이용한 로컬 실행 방식을 제공하고, 개인 클라우드 배포에서는 서버 인증을 통해 API 접근을 제한합니다.