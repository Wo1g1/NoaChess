# NoaChess

독특한 기물 이동 방식을 가진 6×6 체스 변형 게임, Fairy-Stockfish NNUE AI 엔진 탑재.

## 온라인 플레이

🎮 **라이브 데모**: https://noachess.pages.dev/

> **참고**: 이 프로젝트는 SharedArrayBuffer 보안 요구사항으로 인해 Cloudflare Pages 또는 Netlify에서의 배포가 필요합니다. Vercel의 정적 호스팅은 필요한 COOP/COEP 헤더를 지원하지 않습니다.

## 소개

NoaChess의 특징:
- **6×6 보드** - 갈색 체크무늬 패턴
- **독특한 기물**: 리퍼, 변형된 비숍/룩/퀸, 표준 나이트와 킹
- **폰 승급**: 폰이 마지막 랭크에 도달하면 자동으로 장군으로 승급
- **시작 포지션**: `lbqknr/pppppp/6/6/PPPPPP/LBQKNR w - - 0 1`
- **강력한 AI**: Fairy-Stockfish NNUE (깊이 12 탐색, 1-20 조정 가능)

## 기물 이동 방식

| 기물 | 이동 방식 | Betza 표기법 |
|------|----------|-------------|
| **폰 (P)** | 앞/옆으로 1칸 이동, 대각선 앞으로 캡처 | `fsmWfcF` |
| **비숍 (B)** | 대각선 1칸 또는 직선 2칸 점프 | `FD` |
| **룩 (R)** | 직선 방향으로 최대 2칸 | `mR2cR2` |
| **퀸 (Q)** | 나이트 이동 + 대각선 1칸 (총 12칸) | `NF` |
| **리퍼 (L)** | 8방향 1칸 이동; 8방향 2칸 점프 캡처 (알리바바) | `mWmFcAcD` |
| **나이트 (N)** | 표준 L자 이동 | `N` |
| **킹 (K)** | 표준 킹 (왕족 기물) | `K` |
| **장군 (G)** | 모든 방향 1칸 이동 (승급된 폰, 비왕족) | `WF` |

## 기술 스택

- **UI**: [Chessgroundx](https://github.com/gbtami/chessgroundx) - 인터랙티브 체스 보드
- **게임 로직**: [ffish-es6](https://github.com/gbtami/ffish) - Fairy-Stockfish WebAssembly (보드 로직)
- **AI 엔진**: [fairy-stockfish-nnue.wasm](https://github.com/ianfab/fairy-stockfish.wasm) - NNUE 평가 기능이 있는 UCI 체스 엔진
- **빌드**: Browserify + esmify
- **호스팅**: Cloudflare Pages (SharedArrayBuffer를 위한 COOP/COEP/CORP 헤더 포함)

## 로컬 개발

### 사전 요구사항
- Node.js 14+ 및 npm

### 설정
```bash
# 저장소 클론
git clone https://github.com/Wo1g1/NoaChess.git
cd NoaChess

# 의존성 설치
npm install

# 프로젝트 빌드
npm run build

# 로컬 서버 실행 (로컬 서버 필요)
npm run serve
# 또는
npx serve public -p 5000
```

`http://localhost:5000` 방문

> **중요**: 로컬 개발에는 SharedArrayBuffer를 위한 적절한 헤더가 필요합니다. `serve` 패키지가 이를 자동으로 처리하지만, 다른 서버를 사용하는 경우 COOP/COEP 헤더가 설정되어 있는지 확인하세요.

## 배포

### Cloudflare Pages (권장)

Cloudflare Pages는 SharedArrayBuffer에 필요한 `_headers` 파일을 올바르게 지원하므로 권장되는 호스팅 플랫폼입니다.

1. **Cloudflare Pages 연결**:
   - https://pages.cloudflare.com 방문
   - "Create a project" → "Connect to Git" 클릭
   - NoaChess 저장소 선택

2. **빌드 설정**:
   ```
   Framework preset: None
   Build command: npm run build
   Build output directory: public
   Root directory: (비워두기)
   ```

3. **배포**:
   - "Save and Deploy" 클릭
   - 빌드 완료까지 1-2분 대기
   - `https://[random-id].noachess.pages.dev`에서 사이트가 라이브됨

4. **커스텀 도메인** (선택사항):
   - 프로젝트 설정 → Custom domains로 이동
   - 도메인 추가 및 DNS 구성

### Netlify (대안)

Netlify도 `_headers` 파일을 지원합니다:

1. https://app.netlify.com 방문
2. "Add new site" → "Import an existing project"
3. NoaChess 저장소 선택
4. 빌드 설정:
   ```
   Build command: npm run build
   Publish directory: public
   ```
5. 배포

### Vercel을 사용하지 않는 이유?

Vercel의 정적 호스팅은 정적 파일에 `vercel.json` 헤더를 적용하지 않아 SharedArrayBuffer를 사용할 수 없게 됩니다. 이는 Fairy-Stockfish의 pthread 기반 아키텍처를 망가뜨립니다.

**해결 방법**: Next.js로 전환하거나 Edge Functions 사용 (복잡성 증가).

## 파일 구조

```
NoaChess/
├── public/
│   ├── index.html           # 메인 HTML
│   ├── bundle.js            # 컴파일된 JS (생성됨)
│   ├── stockfish.js         # Fairy-Stockfish WASM 로더
│   ├── stockfish.wasm       # Fairy-Stockfish WASM 바이너리
│   ├── stockfish.worker.js  # pthread 워커
│   ├── ffish.wasm           # ffish-es6 WASM 바이너리
│   ├── noachess.ini         # 변형 규칙 설정
│   ├── _headers             # Cloudflare/Netlify 헤더
│   └── assets/              # CSS 및 기물 SVG
├── src/
│   └── main.js              # 메인 게임 로직
├── package.json
├── vercel.json              # Vercel 설정 (정적 사이트에서는 작동 안 함)
└── README.md
```

## 설정

### 변형 규칙 (`public/noachess.ini`)

게임 규칙은 Fairy-Stockfish INI 형식으로 정의됩니다:
- 보드 크기: 6×6
- Betza 표기법을 통한 커스텀 기물 이동
- 승급: 폰 → 6랭크(백) / 1랭크(흑)에서 장군으로 승급
- 캐슬링 없음, 앙파상 없음

### AI 설정

UI에서 조정 가능:
- **탐색 깊이**: 1-20 (기본값: 12)
  - 낮음 = 빠르지만 약함 (빠른 플레이에는 4-6 권장)
  - 높음 = 강하지만 느림 (강한 플레이에는 12-16 권장)

## 보안 헤더

`public/` 디렉토리의 `_headers` 파일은 필수 보안 헤더를 설정합니다:

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: cross-origin
```

이러한 헤더는 Fairy-Stockfish의 멀티스레드 엔진에 필요한 `SharedArrayBuffer`를 활성화합니다.

## 문제 해결

### "SharedArrayBuffer is not defined" 오류

**원인**: COOP/COEP 헤더가 적용되지 않음

**해결책**:
1. 브라우저 개발자 도구에서 헤더 확인 (Network 탭 → Response Headers)
2. 호스팅 플랫폼이 `_headers` 파일을 지원하는지 확인
3. Cloudflare Pages 또는 Netlify 사용 (Vercel 정적 호스팅 제외)

### AI가 작동하지 않음 / 랜덤 수로 대체됨

**원인**: Fairy-Stockfish 초기화 실패

**해결책**:
1. 브라우저 콘솔에서 오류 확인
2. `stockfish.js`, `stockfish.wasm`, `stockfish.worker.js`가 로드되었는지 확인
3. SharedArrayBuffer 사용 가능 확인: `typeof SharedArrayBuffer !== 'undefined'`

### 폰 승급이 작동하지 않음

**원인**: 이동 표기법 불일치

**해결책**: 콘솔 로그에서 "Found promotion move" 메시지 확인. 코드가 승급 수를 자동으로 감지합니다 (예: `e5e6g`).

## 크레딧

- **Fairy-Stockfish**: https://github.com/fairy-stockfish/Fairy-Stockfish
- **ffish-es6**: https://github.com/gbtami/ffish
- **Chessgroundx**: https://github.com/gbtami/chessgroundx
- **영감을 받은 프로젝트**: [Fairyground](https://github.com/ianfab/fairyground) 및 [pychess-variants](https://github.com/gbtami/pychess-variants)

## 라이선스

GPL-3.0 - 자세한 내용은 [LICENSE](LICENSE) 파일 참조

이 프로젝트는 GPL-3.0 라이선스가 적용된 Fairy-Stockfish 및 관련 라이브러리를 사용합니다.
