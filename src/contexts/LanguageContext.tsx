import React, { createContext, useContext, useCallback, useEffect } from 'react';
import { translations, type Lang } from '@/i18n/translations';

interface LanguageContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang: Lang = 'pt';

  useEffect(() => {
    localStorage.setItem('sigemm-lang', 'pt');
    document.documentElement.lang = 'pt-MZ';
  }, []);

  const t = useCallback(
    (key: string) => translations.pt[key] ?? key,
    []
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang: () => {}, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}