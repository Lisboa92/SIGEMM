import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
export type FontSize = 'sm' | 'base' | 'lg' | 'xl';
export type UiDensity = 'compact' | 'normal' | 'spacious';
export type ColorPreset = 'emerald' | 'ocean' | 'slate' | 'amber';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  readingMode: boolean;
  setReadingMode: (enabled: boolean) => void;
  toggleReadingMode: () => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  uiDensity: UiDensity;
  setUiDensity: (density: UiDensity) => void;
  highContrast: boolean;
  setHighContrast: (enabled: boolean) => void;
  reduceMotion: boolean;
  setReduceMotion: (enabled: boolean) => void;
  colorPreset: ColorPreset;
  setColorPreset: (preset: ColorPreset) => void;
  resetAppearance: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('sigemm-theme');
    return (stored === 'dark' ? 'dark' : 'light') as Theme;
  });

  const [readingMode, setReadingModeState] = useState<boolean>(() => {
    return localStorage.getItem('sigemm-reading-mode') === 'true';
  });

  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    return (localStorage.getItem('sigemm-font-size') as FontSize) || 'base';
  });

  const [uiDensity, setUiDensityState] = useState<UiDensity>(() => {
    return (localStorage.getItem('sigemm-ui-density') as UiDensity) || 'normal';
  });

  const [highContrast, setHighContrastState] = useState<boolean>(() => {
    return localStorage.getItem('sigemm-high-contrast') === 'true';
  });

  const [reduceMotion, setReduceMotionState] = useState<boolean>(() => {
    return localStorage.getItem('sigemm-reduce-motion') === 'true';
  });

  const [colorPreset, setColorPresetState] = useState<ColorPreset>(() => {
    return (localStorage.getItem('sigemm-color-preset') as ColorPreset) || 'emerald';
  });

  // Apply classes and attributes to root document
  useEffect(() => {
    const root = document.documentElement;

    // Theme (light/dark)
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('sigemm-theme', theme);

    // Reading Mode (Sepia / Relaxed warm contrast)
    if (readingMode) {
      root.classList.add('reading-mode');
    } else {
      root.classList.remove('reading-mode');
    }
    localStorage.setItem('sigemm-reading-mode', String(readingMode));

    // High Contrast
    if (highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
    localStorage.setItem('sigemm-high-contrast', String(highContrast));

    // Reduce Motion
    if (reduceMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
    localStorage.setItem('sigemm-reduce-motion', String(reduceMotion));

    // UI Density
    root.classList.remove('density-compact', 'density-normal', 'density-spacious');
    root.classList.add(`density-${uiDensity}`);
    localStorage.setItem('sigemm-ui-density', uiDensity);

    // Color Preset
    root.classList.remove('preset-emerald', 'preset-ocean', 'preset-slate', 'preset-amber');
    root.classList.add(`preset-${colorPreset}`);
    localStorage.setItem('sigemm-color-preset', colorPreset);

    // Font Scale
    const fontSizes: Record<FontSize, string> = {
      sm: '14px',
      base: '16px',
      lg: '17.5px',
      xl: '19px',
    };
    root.style.fontSize = fontSizes[fontSize] || '16px';
    localStorage.setItem('sigemm-font-size', fontSize);
  }, [theme, readingMode, fontSize, uiDensity, highContrast, reduceMotion, colorPreset]);

  const setTheme = (t: Theme) => setThemeState(t);
  const toggleTheme = () => setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  const setReadingMode = (e: boolean) => setReadingModeState(e);
  const toggleReadingMode = () => setReadingModeState((prev) => !prev);
  const setFontSize = (s: FontSize) => setFontSizeState(s);
  const setUiDensity = (d: UiDensity) => setUiDensityState(d);
  const setHighContrast = (h: boolean) => setHighContrastState(h);
  const setReduceMotion = (r: boolean) => setReduceMotionState(r);
  const setColorPreset = (p: ColorPreset) => setColorPresetState(p);

  const resetAppearance = () => {
    setThemeState('light');
    setReadingModeState(false);
    setFontSizeState('base');
    setUiDensityState('normal');
    setHighContrastState(false);
    setReduceMotionState(false);
    setColorPresetState('emerald');
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        readingMode,
        setReadingMode,
        toggleReadingMode,
        fontSize,
        setFontSize,
        uiDensity,
        setUiDensity,
        highContrast,
        setHighContrast,
        reduceMotion,
        setReduceMotion,
        colorPreset,
        setColorPreset,
        resetAppearance,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

