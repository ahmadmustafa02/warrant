import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import Script from 'next/script';
import { SiteMotion } from '@/components/motion/SiteMotion';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  variable: '--font-plus-jakarta',
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
});

const plexMono = IBM_Plex_Mono({
  variable: '--font-ibm-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: {
    default: 'Warrant',
    template: '%s · Warrant',
  },
  description:
    'Guard your AI agent against hijacking by the content it reads — block unauthorized actions, with attack-stop and benign-pass measured together.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${jakarta.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Script id="warrant-theme" strategy="beforeInteractive">
          {`(function(){try{if(localStorage.getItem('warrant-theme')==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`}
        </Script>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteMotion>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </SiteMotion>
      </body>
    </html>
  );
}
