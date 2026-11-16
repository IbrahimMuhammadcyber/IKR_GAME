// Interface translations. Missing keys fall back to English.
// NOTE: Hausa / Yoruba / Igbo / Pidgin strings should be proof-read by native speakers.
import type { Lang } from './data';

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'pcm', label: 'Naija Pidgin' },
  { id: 'ha', label: 'Hausa' },
  { id: 'yo', label: 'Yorùbá' },
  { id: 'ig', label: 'Igbo' },
];

const en = {
  play: 'Play Game', career: 'Career Mode', traffic: 'Traffic Racing', trial: 'Time Trial', free: 'Free Ride',
  garage: 'Bike Garage', upgrades: 'Bike Upgrades', achievements: 'Achievements', leaderboard: 'Leaderboard',
  settings: 'Settings', daily: 'Daily Missions', challenge: 'Challenge Mode', back: 'Back',
  speed: 'KM/H', score: 'Score', coins: 'Coins', distance: 'Distance', time: 'Time', nitro: 'Nitro',
  pause: 'Paused', resume: 'Resume', restart: 'Restart', quit: 'Quit to Menu', gameover: 'Game Over',
  newbest: 'New Best!', retry: 'Retry', next: 'Next', select: 'Select', selected: 'Selected', unlock: 'Unlock',
  owned: 'Owned', buy: 'Buy', maxed: 'MAX', claim: 'Claim', claimed: 'Claimed', ride: 'RIDE', brake: 'BRAKE',
  graphics: 'Graphics Quality', sound: 'Sound Volume', music: 'Music Volume', sensitivity: 'Control Sensitivity',
  camera: 'Camera', language: 'Language', reset: 'Reset Game Progress', name: 'Rider Name', level: 'Level',
  mission: 'Mission', complete: 'Mission Complete!', failed: 'Mission Failed', start: 'Start',
};
type Dict = typeof en;

const pcm: Partial<Dict> = {
  play: 'Start Game', traffic: 'Go-Slow Race', trial: 'Beat Di Clock', free: 'Free Ride', garage: 'Bike Garage',
  upgrades: 'Upgrade Am', achievements: 'Wetin You Don Win', leaderboard: 'Top Riders', back: 'Go Back',
  pause: 'Hold On', resume: 'Continue', restart: 'Start Again', quit: 'Comot', gameover: 'Game Don End',
  newbest: 'New Best!', coins: 'Money', retry: 'Try Again', select: 'Pick Am', unlock: 'Open Am', owned: 'Na Your Own',
  graphics: 'Graphics', sound: 'Sound', music: 'Music', language: 'Language', reset: 'Clear Everything', name: 'Your Name',
  complete: 'You Don Win!', failed: 'You Lose', daily: 'Today Mission',
};
const ha: Partial<Dict> = {
  play: 'Fara Wasa', career: 'Sana\'a', traffic: 'Cunkoson Hanya', trial: 'Gasar Lokaci', free: 'Hawa Kyauta',
  garage: 'Rumbun Babura', upgrades: 'Inganta Babur', achievements: 'Nasarori', leaderboard: 'Jerin Gwanaye',
  settings: 'Saituna', back: 'Koma', pause: 'An Dakata', resume: 'Ci gaba', restart: 'Sake Farawa', quit: 'Fita',
  gameover: 'Wasa Ya Kare', score: 'Maki', coins: 'Kuɗi', distance: 'Nisa', time: 'Lokaci', retry: 'Sake Gwadawa',
  select: 'Zaɓa', selected: 'An Zaɓa', unlock: 'Buɗe', owned: 'Naka ne', graphics: 'Ingancin Hoto', sound: 'Ƙarar Sauti',
  music: 'Ƙarar Kiɗa', language: 'Harshe', name: 'Sunan Mahayi', level: 'Matakin', complete: 'An Kammala!', failed: 'Ba a Yi Nasara Ba',
  daily: 'Ayyukan Yau', claim: 'Karɓa', claimed: 'An Karɓa',
};
const yo: Partial<Dict> = {
  play: 'Ṣeré', career: 'Iṣẹ́ Eré', traffic: 'Eré Ọkọ̀ Ojú Ọ̀nà', trial: 'Ìdíje Àkókò', free: 'Gígùn Ọ̀fẹ́',
  garage: 'Ilé Ọkọ̀', upgrades: 'Ìgbéga Ọkọ̀', achievements: 'Àṣeyọrí', leaderboard: 'Àtòkọ Olùborí',
  settings: 'Ètò', back: 'Padà', pause: 'Dúró', resume: 'Tẹ̀síwájú', restart: 'Tún Bẹ̀rẹ̀', quit: 'Jáde',
  gameover: 'Eré Parí', score: 'Àmì', coins: 'Owó', distance: 'Ìjìnnà', time: 'Àkókò', retry: 'Tún Gbìyànjú',
  select: 'Yàn', selected: 'A Yàn', unlock: 'Ṣí', owned: 'Tìrẹ', graphics: 'Dídára Àwòrán', sound: 'Ìró', music: 'Orin',
  language: 'Èdè', name: 'Orúkọ Atẹ́lẹ̀rù', level: 'Ìpele', complete: 'Iṣẹ́ Parí!', failed: 'O Kùnà', daily: 'Iṣẹ́ Òní',
  claim: 'Gbà', claimed: 'A Ti Gbà',
};
const ig: Partial<Dict> = {
  play: 'Gwa Egwuregwu', career: 'Ọrụ Egwuregwu', traffic: 'Ụgbọ Okporo Ụzọ', trial: 'Asọmpi Oge', free: 'Ịnya N\'efu',
  garage: 'Ụlọ Ụgbọ', upgrades: 'Nkwalite Ụgbọ', achievements: 'Mmeri', leaderboard: 'Ndepụta Ndị Mmeri',
  settings: 'Ntọala', back: 'Laghachi', pause: 'Kwụsịrị', resume: 'Gaa n\'ihu', restart: 'Malitegharịa', quit: 'Pụọ',
  gameover: 'Egwuregwu Agwụla', score: 'Akara', coins: 'Ego', distance: 'Anya', time: 'Oge', retry: 'Nwaa Ọzọ',
  select: 'Họrọ', selected: 'Ahọrọla', unlock: 'Mepee', owned: 'Nke Gị', graphics: 'Ogo Foto', sound: 'Ụda', music: 'Egwú',
  language: 'Asụsụ', name: 'Aha Onye Na-anya', level: 'Larị', complete: 'Ọrụ Zuru Ezu!', failed: 'Ọ Dara', daily: 'Ọrụ Taa',
  claim: 'Nata', claimed: 'Anatala',
};

const dicts: Record<Lang, Partial<Dict>> = { en, pcm, ha, yo, ig };

export type TKey = keyof Dict;
export const tr = (lang: Lang, key: TKey): string => (dicts[lang] && dicts[lang][key]) || en[key];
