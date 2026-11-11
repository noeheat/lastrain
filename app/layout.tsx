import type { Metadata, Viewport } from 'next';
import { Barlow_Condensed } from 'next/font/google';
import { ServiceWorker } from '@/components/ServiceWorker';

// 카운트다운 숫자: 좁고 키 큰 굵은 글꼴 (빌드할 때 받아서 우리 도메인에서 서빙)
const num = Barlow_Condensed({ weight: '600', subsets: ['latin'], variable: '--font-num', display: 'swap' });
import './globals.css';

export const metadata: Metadata = {
  title: '막차 카운트다운',
  description: '두 사람의 막차 출발 시각까지 카운트다운',
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
  appleWebApp: { capable: true, title: '막차', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b0d10',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={num.variable}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
