"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    kakao: any;
  }
}

let loadingPromise: Promise<void> | null = null;

function loadKakaoScript(appKey: string): Promise<void> {
  if (typeof window !== "undefined" && window.kakao?.maps) return Promise.resolve();
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(
          "Kakao Maps SDK 로드 시간 초과. 광고차단 확장프로그램을 꺼보거나, Kakao Developers 콘솔 > 플랫폼 > Web에 이 도메인이 등록되어 있는지 확인하세요."
        )
      );
    }, 8000);

    const script = document.createElement("script");
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=clusterer,services`;
    script.onload = () => {
      clearTimeout(timeout);
      try {
        window.kakao.maps.load(() => resolve());
      } catch (e) {
        reject(new Error("Kakao Maps SDK 초기화 실패 — JavaScript 키 값이 올바른지 확인하세요."));
      }
    };
    script.onerror = () => {
      clearTimeout(timeout);
      reject(
        new Error(
          "Kakao Maps SDK 스크립트 로드 실패. 광고차단 확장프로그램, 방화벽, 또는 JavaScript 키 오타(공백 포함 여부)를 확인하세요."
        )
      );
    };
    document.head.appendChild(script);
  });

  return loadingPromise;
}

/** Kakao Maps JS SDK를 동적으로 로드한다. NEXT_PUBLIC_KAKAO_MAP_KEY가 없으면 ready=false로 유지된다. */
export function useKakaoMapsLoader() {
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appKey) return;
    loadKakaoScript(appKey)
      .then(() => setReady(true))
      .catch((e) => setError(e.message));
  }, [appKey]);

  return { ready, error, hasKey: !!appKey };
}
