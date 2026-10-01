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

    video.muted = false;
    video.volume = 1;

    const start = () => {
      video.muted = false;
      void video.play();
    };

    // Browsers block autoplay when audio is on. Play immediately, and if
    // that is refused, start with sound on the first click or keypress.
    void video.play().catch(() => {
      const resume = () => {
        start();
        window.removeEventListener('pointerdown', resume);
        window.removeEventListener('keydown', resume);
      };
      window.addEventListener('pointerdown', resume);
      window.addEventListener('keydown', resume);
    });
  }, []);

  return (
    <video
      ref={ref}
      className="absolute inset-0 h-full w-full object-contain"
      src={SRC}
      autoPlay
      loop
      playsInline
      preload="auto"
      aria-label="Glowing particles flowing toward a crystal"
    />
  );
}
