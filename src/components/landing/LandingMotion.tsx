'use client';

import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

export function LandingMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add(
        {
          reduce: '(prefers-reduced-motion: reduce)',
          motion: '(prefers-reduced-motion: no-preference)',
        },
        (context) => {
          if (context.conditions?.reduce) {
            return;
          }

          gsap.from('.hero-line', {
            y: 28,
            autoAlpha: 0,
            duration: 0.7,
            ease: 'power3.out',
            stagger: 0.08,
          });
          gsap.from('.hero-visual', {
            y: 36,
            autoAlpha: 0,
            duration: 0.85,
            delay: 0.2,
            ease: 'power3.out',
          });
          gsap.from('.stat-card', {
            y: 20,
            autoAlpha: 0,
            duration: 0.55,
            stagger: 0.08,
            delay: 0.35,
            ease: 'power3.out',
          });
        },
      );

      return () => media.revert();
    },
    { scope: root },
  );

  return <div ref={root}>{children}</div>;
}
