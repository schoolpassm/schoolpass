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
    const script = document.createElement("script");
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=clusterer,services`;
    script.onload = () => {
      window.kakao.maps.load(() => resolve());
    };
    script.onerror = () => reject(new Error("Kakao Maps SDK 로드 실패"));
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
