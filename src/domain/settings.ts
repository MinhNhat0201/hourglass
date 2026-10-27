export type Ringtone = 'chime' | 'bell' | 'soft';
export type Language = 'system' | 'vi' | 'en';

export interface Settings {
  sound: boolean;
  vibration: boolean;
  ringtone: Ringtone;
  /** Lying the device flat for 2 s pauses the hourglass (spec §5.2, §12.6). */
  pauseWhenFlat: boolean;
  /** Show the countdown digits by default (spec §12.5). */
  showDigits: boolean;
  largeDigits: boolean;
  language: Language;
  tags: string[];
}

export const RINGTONES: Ringtone[] = ['chime', 'bell', 'soft'];

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  vibration: true,
  ringtone: 'chime',
  pauseWhenFlat: true,
  showDigits: true,
  largeDigits: false,
  language: 'system',
  tags: [],
};

export const SAND_COLORS = ['#D8BC84', '#E3A869', '#C98B7A', '#9FB6A0', '#8FA9C6', '#B7A4CF', '#E8E1D3', '#5E5A55'];
