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

  const serviceAccount = JSON.parse(raw);

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}
