import React, { createContext, useContext, useState } from 'react';
import type { Language } from '../../shared/types.js';
import type { LocalizedText } from '../../shared/gameTypes.js';
import { TRANSLATIONS, type TranslationKey } from './translations.js';

interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  pick: (item: LocalizedText | undefined | null) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('vt_lang');
    if (saved === 'zh' || saved === 'en') return saved;
    return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  });

  const setLang = (next: Language) => {
    setLangState(next);
    localStorage.setItem('vt_lang', next);
  };

  const t = (key: TranslationKey, vars?: Record<string, string | number>) => {
    let text: string = TRANSLATIONS[lang][key] ?? TRANSLATIONS.zh[key];
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  };

  const pick = (item: LocalizedText | undefined | null) => {
    if (!item) return '';
    return lang === 'zh' ? item.zh : item.en;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t, pick }}>
      {children}
    </I18nContext.Provider>
  );
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
