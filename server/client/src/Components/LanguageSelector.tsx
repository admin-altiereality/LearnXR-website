/**
 * Language Selector Component
 * Allows users to switch between English and Hindi content
 * 
 * Used in:
 * - /lessons page for selecting lesson language
 * - /studio for previewing content in different languages
 */

import React, { memo } from 'react';
import { Globe, ChevronDown } from 'lucide-react';
import type { LanguageCode } from '../types/curriculum';

// Language metadata
const LANGUAGES: Record<LanguageCode, { name: string; nativeName: string; flag: string }> = {
  en: {
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧',
  },
  hi: {
    name: 'Hindi',
    nativeName: 'हिंदी',
    flag: '🇮🇳',
  },
};

interface LanguageSelectorProps {
  value: LanguageCode;
  onChange: (language: LanguageCode) => void;
  availableLanguages?: LanguageCode[];
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'compact' | 'pill';
  showFlags?: boolean;
  showNativeNames?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Dropdown-style language selector
 */
export const LanguageSelector = memo(({
  value,
  onChange,
  availableLanguages = ['en', 'hi'],
  size = 'md',
  variant = 'default',
  showFlags = true,
  showNativeNames = false,
  disabled = false,
  className = '',
}: LanguageSelectorProps) => {
  const selectedLang = LANGUAGES[value];
  
  // Size classes
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2.5 text-base',
  };
  
  // Variant classes
  const variantClasses = {
    default: `bg-slate-800/50 border border-slate-700/50 rounded-lg 
              hover:bg-slate-700/50 hover:border-slate-600/50 
              focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50`,
    compact: `bg-slate-800/30 border border-slate-700/30 rounded-md 
              hover:bg-slate-700/30`,
    pill: `bg-gradient-to-r from-slate-800/50 to-slate-700/50 
           border border-slate-600/50 rounded-full 
           hover:from-slate-700/50 hover:to-slate-600/50`,
  };
  
  return (
    <div className={`relative inline-block ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as LanguageCode)}
        disabled={disabled}
        className={`appearance-none cursor-pointer text-white 
                   ${sizeClasses[size]} ${variantClasses[variant]}
                   pr-8 transition-all duration-200 outline-none
                   disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {availableLanguages.map((lang) => {
          const langInfo = LANGUAGES[lang];
          return (
            <option key={lang} value={lang} className="bg-slate-800 text-white">
              {showFlags ? `${langInfo.flag} ` : ''}
              {showNativeNames ? langInfo.nativeName : langInfo.name}
            </option>
          );
        })}
      </select>
      
      {/* Dropdown icon */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
        <ChevronDown className={`text-slate-400 ${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}`} />
      </div>
    </div>
  );
});

LanguageSelector.displayName = 'LanguageSelector';

/**
 * Button-group style language toggle (for exactly 2 languages)
 */
interface LanguageToggleProps {
  value: LanguageCode;
  onChange: (language: LanguageCode) => void;
  size?: 'sm' | 'md' | 'lg';
  showFlags?: boolean;
  disabled?: boolean;
  className?: string;
}

export const LanguageToggle = memo(({
  value,
  onChange,
  size = 'md',
  showFlags = true,
  disabled = false,
  className = '',
}: LanguageToggleProps) => {
  const languages: LanguageCode[] = ['en', 'hi'];
  
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };
  
  return (
    <div 
      className={`inline-flex rounded-lg bg-slate-800/50 border border-slate-700/50 p-0.5 ${className}`}
      role="group"
    >
      {languages.map((lang) => {
        const langInfo = LANGUAGES[lang];
        const isSelected = value === lang;
        
        return (
          <button
            key={lang}
            type="button"
            onClick={() => onChange(lang)}
            disabled={disabled}
            className={`${sizeClasses[size]} rounded-md font-medium transition-all duration-200
                       ${isSelected
                         ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                         : 'text-slate-400 hover:text-white hover:bg-slate-700/50 border border-transparent'
                       }
                       disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {showFlags && <span className="mr-1">{langInfo.flag}</span>}
            {langInfo.name}
          </button>
        );
      })}
    </div>
  );
});

LanguageToggle.displayName = 'LanguageToggle';

/**
 * Compact icon-only language button with dropdown
 */
interface LanguageIconButtonProps {
  value: LanguageCode;
  onChange: (language: LanguageCode) => void;
  availableLanguages?: LanguageCode[];
  className?: string;
}

export const LanguageIconButton = memo(({
  value,
  onChange,
  availableLanguages = ['en', 'hi'],
  className = '',
}: LanguageIconButtonProps) => {
  const selectedLang = LANGUAGES[value];
  
  return (
    <div className={`relative group ${className}`}>
      <button
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg
                 bg-slate-800/50 border border-slate-700/50
                 hover:bg-slate-700/50 hover:border-slate-600/50
                 transition-all duration-200"
        title={`Language: ${selectedLang.name}`}
      >
        <Globe className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-300">{selectedLang.flag}</span>
        <ChevronDown className="w-3 h-3 text-slate-500" />
      </button>
      
      {/* Dropdown menu */}
      <div className="absolute top-full right-0 mt-1 w-32 py-1 
                    bg-slate-800 border border-slate-700 rounded-lg shadow-xl
                    opacity-0 invisible group-hover:opacity-100 group-hover:visible
                    transition-all duration-200 z-50">
        {availableLanguages.map((lang) => {
          const langInfo = LANGUAGES[lang];
          const isSelected = value === lang;
          
          return (
            <button
              key={lang}
              onClick={() => onChange(lang)}
              className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2
                        ${isSelected
                          ? 'bg-cyan-500/10 text-cyan-300'
                          : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                        } transition-colors`}
            >
              <span>{langInfo.flag}</span>
              <span>{langInfo.name}</span>
              {isSelected && (
                <span className="ml-auto text-cyan-400">✓</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});

LanguageIconButton.displayName = 'LanguageIconButton';

/**
 * Badge showing language availability
 */
interface LanguageBadgeProps {
  languages: LanguageCode[];
  size?: 'sm' | 'md';
  className?: string;
}

export const LanguageBadge = memo(({
  languages,
  size = 'sm',
  className = '',
}: LanguageBadgeProps) => {
  if (languages.length === 0) return null;
  
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
  };
  
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {languages.map((lang) => {
        const langInfo = LANGUAGES[lang];
        return (
          <span
            key={lang}
            className={`${sizeClasses[size]} rounded font-medium
                       bg-slate-700/50 text-slate-300 border border-slate-600/30`}
            title={langInfo.name}
          >
            {langInfo.flag}
          </span>
        );
      })}
    </div>
  );
});

LanguageBadge.displayName = 'LanguageBadge';

// Export language metadata for use elsewhere
export { LANGUAGES };
export default LanguageSelector;
