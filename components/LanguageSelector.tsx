import React, { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useI18n } from "../contexts/I18nContext";
import { LOCALES, SUPPORTED_LOCALES, type Locale } from "../lib/locale";

type Variant = "sidebar" | "compact";

interface LanguageSelectorProps {
  /** `sidebar` matches the nav buttons; `compact` is a pill for auth screens. */
  variant?: Variant;
  className?: string;
}

const Flag: React.FC<{ locale: Locale; size?: "sm" | "md" }> = ({
  locale,
  size = "md",
}) => (
  <span
    className={`leading-none select-none ${
      size === "sm" ? "text-base" : "text-lg"
    }`}
    aria-hidden
  >
    {LOCALES[locale].flag}
  </span>
);

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = "sidebar",
  className = "",
}) => {
  const { locale, setLocale, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const select = (next: Locale) => {
    setLocale(next);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const moveSelection = (direction: 1 | -1) => {
    const currentIndex = SUPPORTED_LOCALES.indexOf(locale);
    const nextIndex =
      (currentIndex + direction + SUPPORTED_LOCALES.length) %
      SUPPORTED_LOCALES.length;
    setLocale(SUPPORTED_LOCALES[nextIndex]);
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (isOpen) {
        moveSelection(event.key === "ArrowDown" ? 1 : -1);
      } else {
        setIsOpen(true);
      }
    }
  };

  const isSidebar = variant === "sidebar";

  const triggerClasses = isSidebar
    ? "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-indigo-400 transition-all duration-200"
    : "flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition-colors";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleTriggerKeyDown}
        className={triggerClasses}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-label={`${t("language.trigger")} (${LOCALES[locale].nativeName})`}
        title={t("language.trigger")}
      >
        <Flag locale={locale} size={isSidebar ? "md" : "sm"} />
        {isSidebar ? (
          <>
            <span className="font-medium flex-1 text-left">
              {t("language.label")}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {LOCALES[locale].shortCode}
            </span>
          </>
        ) : (
          <span className="text-sm font-medium">
            <span className="hidden sm:inline">
              {LOCALES[locale].nativeName}
            </span>
            <span className="sm:hidden">{LOCALES[locale].shortCode}</span>
          </span>
        )}
        <ChevronDown
          size={isSidebar ? 16 : 14}
          className={`transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {isOpen && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t("language.options")}
          className={`absolute z-50 w-full min-w-[11rem] p-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl ${
            isSidebar ? "bottom-full mb-2" : "right-0 top-full mt-2"
          }`}
        >
          {SUPPORTED_LOCALES.map((option) => {
            const isSelected = option === locale;

            return (
              <li key={option} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => select(option)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    isSelected
                      ? "bg-indigo-600/20 text-indigo-300"
                      : "text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2.5 font-medium">
                    <Flag locale={option} size="sm" />
                    {LOCALES[option].nativeName}
                  </span>
                  {isSelected ? (
                    <Check size={16} aria-hidden />
                  ) : (
                    <span className="text-xs text-slate-500">
                      {LOCALES[option].shortCode}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default LanguageSelector;
