import { Language } from '../types';
import { en } from './en';
import { te } from './te';
import { ta } from './ta';
import { hi } from './hi';

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en,
  te,
  ta,
  hi,
};

export const SUPPORTED_LANGUAGES: Array<{ code: Language; name: string; nativeName: string; flag: string }> = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
];

/**
 * Translates a key for a given language, falling back to English, then the key itself.
 */
export function t(key: string, lang: Language = 'en'): string {
  const normalizedLang: Language = TRANSLATIONS[lang] ? lang : 'en';
  return TRANSLATIONS[normalizedLang]?.[key] || TRANSLATIONS.en?.[key] || key;
}

export function getLanguageName(lang: Language): string {
  switch (lang) {
    case 'te':
      return 'తెలుగు (Telugu)';
    case 'ta':
      return 'தமிழ் (Tamil)';
    case 'hi':
      return 'हिन्दी (Hindi)';
    default:
      return 'English';
  }
}

export function getLanguageFlag(lang: Language): string {
  switch (lang) {
    case 'te':
    case 'ta':
    case 'hi':
      return '🇮🇳';
    default:
      return '🇬🇧';
  }
}

export { en, te, ta, hi };
