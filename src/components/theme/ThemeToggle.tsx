'use client';

import { Moon, Sun } from 'lucide-react';

function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem('warrant-theme', theme);
}

export function ThemeToggle() {
  return (
    <button
      type="button"
      className="pressable inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--ink)] hover:bg-[var(--stage)]"
      aria-label="Toggle dark mode"
      onClick={() => {
        const next = document.documentElement.classList.contains('dark')
          ? 'light'
          : 'dark';
        applyTheme(next);
      }}
    >
      <Moon className="h-4 w-4 dark:hidden" />
      <Sun className="hidden h-4 w-4 dark:block" />
    </button>
  );
}
