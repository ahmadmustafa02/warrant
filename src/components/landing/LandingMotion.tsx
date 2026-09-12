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

          const timeline = gsap.timeline({
            defaults: { ease: 'power3.out', duration: 0.7 },
          });
          timeline.from('.hero-line', {
            y: 28,
            autoAlpha: 0,
            stagger: 0.08,
          });
          timeline.from(
            '.metric-card',
            { y: 18, autoAlpha: 0, stagger: 0.07, duration: 0.55 },
            '-=0.35',
          );
          timeline.from(
            '.step-card',
            { y: 16, autoAlpha: 0, stagger: 0.06, duration: 0.5 },
            '-=0.25',
          );
        },
      );

      return () => media.revert();
    },
    { scope: root },
  );

  return <div ref={root}>{children}</div>;
}
