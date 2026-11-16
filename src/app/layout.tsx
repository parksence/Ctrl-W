import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// 제목용 글꼴. scripts/subset-font.mjs가 화면에 쓰는 글자만 골라 만든 파일입니다.
const display = localFont({
  src: "../fonts/display.woff2",
  variable: "--font-bhs",
  weight: "400",
  display: "swap",
  adjustFontFallback: false,
});

const title = "휘발 | 쓰고, 날리고, 잊는 디지털 대나무숲";
const description =
  "퇴사 마려운 날 회사에서 몰래 쓰는 디지털 파쇄기. 로그인 없이 쏟아내고 파쇄, 소각, 블랙홀로 날려버리세요. 입력한 내용은 서버로 전송되지 않습니다.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: title, template: "%s | 휘발" },
  description,
  applicationName: "휘발",
  referrer: "no-referrer",
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "ko_KR", siteName: "휘발", title, description, url: "/" },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#0a0f0d",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={display.variable}>
      <body>{children}</body>
    </html>
  );
}
