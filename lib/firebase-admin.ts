import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * 서버 전용 Firebase Admin 초기화.
 * 절대 클라이언트 컴포넌트("use client")에서 import 하지 말 것 —
 * API Route(app/api/**)와 같은 서버 실행 환경에서만 사용한다.
 *
 * 환경변수 FIREBASE_SERVICE_ACCOUNT_KEY 에는 Firebase 콘솔에서 발급받은
 * 서비스 계정 JSON 전체를 한 줄 문자열로 넣는다.
 * (프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성)
 */
function getAdminApp(): App {
  if (getApps().length) return getApps()[0];

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY 환경변수가 설정되지 않았습니다. Firebase 콘솔 > 프로젝트 설정 > 서비스 계정에서 발급받아 등록하세요."
    );
  }

  const serviceAccount = parseServiceAccount(raw);

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

/**
 * FIREBASE_SERVICE_ACCOUNT_KEY 파싱.
 * Vercel 환경변수 UI에 JSON을 붙여넣을 때 흔히 발생하는 문제들을 방어적으로 처리한다:
 * - 앞뒤에 실수로 따옴표가 추가로 감싸진 경우
 * - private_key 필드의 "\n"이 실제 줄바꿈으로 깨져 JSON 자체가 파싱 안 되는 경우
 */
function parseServiceAccount(raw: string) {
  let text = raw.trim();

  // 값 전체가 따옴표로 한 번 더 감싸진 경우 제거
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1);
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    // private_key 안의 실제 줄바꿈을 다시 \n 이스케이프로 되돌려 재시도
    try {
      const fixed = text.replace(/(-----BEGIN PRIVATE KEY-----)([\s\S]*?)(-----END PRIVATE KEY-----)/, (_m, head, body, tail) => {
        return head + body.replace(/\r?\n/g, "\\n") + tail;
      });
      return JSON.parse(fixed);
    } catch (err2) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY 파싱 실패: JSON 형식이 아닙니다. Firebase 콘솔에서 받은 JSON 파일 내용을 그대로(따옴표 추가 없이) 붙여넣었는지 확인하세요. 원본 오류: " +
          (err instanceof Error ? err.message : String(err))
      );
    }
  }
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}
