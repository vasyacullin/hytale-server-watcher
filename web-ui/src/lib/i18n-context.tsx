import {
  createContextId,
  useContext,
  useContextProvider,
  useSignal,
  useVisibleTask$,
  type Signal,
} from "@builder.io/qwik";
import {
  type Language,
  type TranslationKey,
  translations,
  getStoredLanguage,
  setStoredLanguage,
} from "./i18n";

export const LanguageContext = createContextId<Signal<Language>>("language");

export function useLanguageProvider() {
  const language = useSignal<Language>("en");

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    language.value = getStoredLanguage();
  });

  useContextProvider(LanguageContext, language);

  return language;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useTranslation() {
  const language = useLanguage();

  return {
    t: (key: TranslationKey) => translations[language.value][key] || translations.en[key] || key,
    language,
    setLanguage: (lang: Language) => {
      language.value = lang;
      setStoredLanguage(lang);
    },
  };
}
