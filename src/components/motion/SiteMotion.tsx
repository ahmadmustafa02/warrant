'use client';

import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function SiteMotion({ children }: { children: ReactNode }) {
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

          gsap.from('.site-header-shell', {
            y: -16,
            autoAlpha: 0,
            duration: 0.65,
            ease: 'power3.out',
            delay: 0.05,
          });

          ScrollTrigger.batch('[data-reveal]', {
            start: 'top 88%',
            onEnter: (batch) => {
              gsap.from(batch, {
                y: 36,
                autoAlpha: 0,
                duration: 0.75,
                stagger: 0.08,
                ease: 'power3.out',
                overwrite: 'auto',
              });
            },
          });

          gsap.utils
            .toArray<HTMLElement>('[data-reveal-stagger]')
            .forEach((container) => {
              const items = container.querySelectorAll(':scope > *');
              if (items.length === 0) {
                return;
              }
              gsap.from(items, {
                scrollTrigger: {
                  trigger: container,
                  start: 'top 86%',
                  toggleActions: 'play none none reverse',
                },
                y: 32,
                autoAlpha: 0,
                duration: 0.7,
                stagger: 0.1,
                ease: 'power3.out',
              });
            });
        },
      );

      return () => media.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} className="flex min-h-0 flex-1 flex-col">
      {children}
    </div>
  );
}
