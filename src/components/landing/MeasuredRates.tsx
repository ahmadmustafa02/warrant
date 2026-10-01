'use client';

import { useEffect, useRef, useState } from 'react';

const rates = [
  {
    done: 60,
    total: 60,
    percent: 100,
    label: 'Attacks stopped',
    note: 'tuned attack corpus',
  },
  {
    done: 22,
    total: 24,
    percent: 92,
    label: 'Benign tasks passed',
    note: 'no-overblock signal',
  },
  {
    done: 15,
    total: 15,
    percent: 100,
    label: 'Held-out stopped',
    note: 'unseen attack set',
  },
] as const;

const DURATION_MS = 1400;

function easeOutCubic(progress: number) {
  return 1 - (1 - progress) ** 3;
}

export function MeasuredRates() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) {
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const frame = requestAnimationFrame(() => {
        setProgress(1);
      });
      return () => {
        cancelAnimationFrame(frame);
      };
    }

    let frame = 0;
    let started = false;

    const start = () => {
      if (started) {
        return;
      }
      started = true;
      const began = performance.now();
      const tick = (now: number) => {
        const next = Math.min(1, (now - began) / DURATION_MS);
        setProgress(easeOutCubic(next));
        if (next < 1) {
          frame = requestAnimationFrame(tick);
        }
      };
      frame = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          start();
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );

    const connect = () => {
      observer.observe(node);
    };

    if (document.readyState === 'complete') {
      connect();
    } else {
      window.addEventListener('load', connect, { once: true });
    }

    return () => {
      window.removeEventListener('load', connect);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={rootRef} className="grid gap-10 sm:grid-cols-3 sm:gap-8">
      {rates.map((rate) => {
        const done = Math.round(rate.done * progress);
        const total = Math.round(rate.total * progress);
        const percent = Math.round(rate.percent * progress);
        return (
          <div key={rate.label}>
            <p
              className="text-5xl font-medium tracking-tight text-white tabular-nums sm:text-6xl"
              aria-label={`${rate.done} / ${rate.total}`}
            >
              <span aria-hidden="true">
                {done} / {total}
              </span>
            </p>
            <p className="mt-4 text-[11px] font-medium tracking-[0.16em] text-white/75 uppercase">
              {rate.label}
            </p>
            <p className="mt-1 text-sm text-white/40">{rate.note}</p>
            <div className="mt-4 flex items-center gap-3">
              <div
                className="min-w-0 flex-1 overflow-hidden rounded-full"
                style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.16)' }}
              >
                <div
                  className="rounded-full"
                  style={{
                    width: `${rate.percent * progress}%`,
                    height: '100%',
                    backgroundColor: '#e8b56a',
                  }}
                />
              </div>
              <span
                className="w-9 shrink-0 text-right text-xs text-white/55 tabular-nums"
                aria-label={`${rate.percent}%`}
              >
                <span aria-hidden="true">{percent}%</span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
