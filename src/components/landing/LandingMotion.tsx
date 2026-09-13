'use client';

import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

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

          const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
          heroTl
            .from('.hero-line', {
              y: 36,
              autoAlpha: 0,
              duration: 0.8,
              stagger: 0.09,
            })
            .from(
              '.hero-visual',
              {
                y: 56,
                scale: 0.96,
                autoAlpha: 0,
                duration: 1.05,
              },
              '-=0.4',
            );

          gsap.to('.hero-visual-inner', {
            y: -48,
            ease: 'none',
            scrollTrigger: {
              trigger: '.hero-visual',
              start: 'top bottom',
              end: 'bottom top',
              scrub: 1.25,
            },
          });

          gsap.to('.hero-float', {
            y: 12,
            duration: 5.5,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
          });

          gsap.utils.toArray<HTMLElement>('.reveal-section').forEach((section) => {
            const copy = section.querySelector('.reveal-copy');
            const visual = section.querySelector('.reveal-visual');

            if (copy) {
              gsap.from(copy, {
                scrollTrigger: {
                  trigger: section,
                  start: 'top 84%',
                  toggleActions: 'play none none reverse',
                },
                y: 52,
                autoAlpha: 0,
                duration: 0.9,
                ease: 'power3.out',
              });
            }

            if (visual) {
              gsap.from(visual, {
                scrollTrigger: {
                  trigger: section,
                  start: 'top 84%',
                  toggleActions: 'play none none reverse',
                },
                y: 72,
                scale: 0.92,
                autoAlpha: 0,
                duration: 1,
                ease: 'power3.out',
              });
            }
          });

          ScrollTrigger.batch('.reveal-card', {
            start: 'top 90%',
            onEnter: (batch) => {
              gsap.from(batch, {
                y: 40,
                autoAlpha: 0,
                duration: 0.7,
                stagger: 0.11,
                ease: 'power3.out',
                overwrite: 'auto',
              });
            },
          });

          ScrollTrigger.batch('.stat-card', {
            start: 'top 88%',
            onEnter: (batch) => {
              gsap.from(batch, {
                y: 32,
                autoAlpha: 0,
                duration: 0.65,
                stagger: 0.12,
                ease: 'power3.out',
                overwrite: 'auto',
              });
            },
          });

          gsap.utils.toArray<HTMLElement>('.reveal-bar').forEach((bar) => {
            gsap.from(bar, {
              scrollTrigger: {
                trigger: bar,
                start: 'top 92%',
                toggleActions: 'play none none reverse',
              },
              scaleX: 0,
              transformOrigin: 'left center',
              duration: 0.85,
              ease: 'power3.out',
            });
          });
        },
      );

      return () => media.revert();
    },
    { scope: root },
  );

  return <div ref={root}>{children}</div>;
}
