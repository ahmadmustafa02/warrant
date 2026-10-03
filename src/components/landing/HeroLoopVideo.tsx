'use client';

import { useEffect, useRef } from 'react';

const SRC = '/Glowing_particles_flow_toward_cr\u2026_20261001225933.mp4';

export function HeroLoopVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) {
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    // iOS only autoplays inline video when the muted attribute is set.
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');

    const playMuted = () => {
      video.muted = true;
      return video.play();
    };

    const start = () => {
      void playMuted()
        .then(() => {
          const desktop = window.matchMedia('(min-width: 768px)').matches;
          if (!desktop) {
            return;
          }
          video.muted = false;
          video.volume = 1;
          return video.play().catch(() => {
            video.muted = true;
            return video.play();
          });
        })
        .catch(() => {
          // A phone still refuses until the clip is on screen or tapped.
        });
    };

    start();

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && video.paused) {
          start();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(video);

    const resume = () => {
      if (video.paused) {
        start();
      }
    };
    window.addEventListener('pointerdown', resume);
    window.addEventListener('touchstart', resume);

    return () => {
      observer.disconnect();
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('touchstart', resume);
    };
  }, []);

  return (
    <video
      ref={ref}
      className="absolute inset-0 h-full w-full object-contain"
      src={SRC}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      aria-label="Glowing particles flowing toward a crystal"
    />
  );
}
