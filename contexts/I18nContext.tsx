import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Locale } from "../lib/locale";
import {
  formatDate,
  formatDateTime,
  formatShortTime,
  formatTime,
  readStoredLocale,
  resolveInitialLocale,
  setActiveLocale,
  translate,
  writeStoredLocale,
  type MessageKey,
  type MessageVars,
} from "../lib/i18n";

export type TranslateFn = (key: MessageKey, vars?: MessageVars) => string;

interface I18nContextValue {
  locale: Locale;
  /** True when the user picked the language explicitly on this device. */
  hasExplicitLocale: boolean;
  /** Changes the language and persists it as an explicit user choice. */
  setLocale: (locale: Locale) => void;
  /**
   * Applies a language coming from the server without marking it as an
   * explicit choice, so a later user selection always wins.
   */
  adoptServerLocale: (locale: Locale) => void;
  t: TranslateFn;
  formatDate: (value: Date | string | number) => string;
  formatTime: (value: Date | string | number) => string;
  formatShortTime: (value: Date | string | number) => string;
  formatDateTime: (value: Date | string | number) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
};

/** Convenience hook for components that only need the translate function. */
export const useTranslation = (): {
  t: TranslateFn;
  locale: Locale;
} => {
  const { t, locale } = useI18n();
  return { t, locale };
};

interface I18nProviderProps {
  children: ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const initial = resolveInitialLocale();
    setActiveLocale(initial);
    return initial;
  });
  const [hasExplicitLocale, setHasExplicitLocale] = useState<boolean>(
    () => readStoredLocale() !== null
  );
  const localeRef = useRef(locale);
  localeRef.current = locale;

  useEffect(() => {
    setActiveLocale(locale);
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    writeStoredLocale(next);
    setHasExplicitLocale(true);
    setActiveLocale(next);
    setLocaleState(next);
  }, []);

  const adoptServerLocale = useCallback((next: Locale) => {
    if (localeRef.current === next) {
      return;
    }
    setActiveLocale(next);
    setLocaleState(next);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      hasExplicitLocale,
      setLocale,
      adoptServerLocale,
      t: (key, vars) => translate(locale, key, vars),
      formatDate: (input) => formatDate(input, locale),
      formatTime: (input) => formatTime(input, locale),
      formatShortTime: (input) => formatShortTime(input, locale),
      formatDateTime: (input) => formatDateTime(input, locale),
    }),
    [locale, hasExplicitLocale, setLocale, adoptServerLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};
