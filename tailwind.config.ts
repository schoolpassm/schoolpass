import type { Config } from "tailwindcss";

// 디자인 토큰: Blue + White 관리자 대시보드
// primary: 신뢰감 있는 딥블루 계열 (스쿨패스 브랜드 톤)
// surface: 화이트/그레이 계열로 데이터 가독성 우선
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#EEF3FF",
          100: "#DCE7FF",
          200: "#B8CEFF",
          300: "#8FB0FF",
          400: "#5C87F5",
          500: "#3B63E0", // base
          600: "#2C4CC4",
          700: "#233DA0",
          800: "#1C3080",
          900: "#162660",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F5F7FB",
          border: "#E5E9F2",
        },
        ink: {
          900: "#101828",
          700: "#344054",
          500: "#667085",
          300: "#98A2B3",
        },
        status: {
          new: "#98A2B3",
          calling: "#3B63E0",
          sent: "#7A5CF0",
          visit: "#F0A93B",
          demo: "#3BC7F0",
          quote: "#F0733B",
          negotiate: "#E0A83B",
          contract: "#2FBF71",
          done: "#16A34A",
          danger: "#E0483B",
        },
      },
      fontFamily: {
        sans: ["Pretendard", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(16, 24, 40, 0.05)",
        pop: "0 4px 24px -4px rgba(16, 24, 40, 0.12)",
      },
      borderRadius: {
        xl: "12px",
      },
    },
  },
  plugins: [],
};
export default config;
