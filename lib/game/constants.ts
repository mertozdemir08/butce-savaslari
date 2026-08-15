/** Lot kapandiktan sonra sonraki lotun acilmasi icin beklenen sure (ms). */
export const RESULT_MS = 2000;

/** Oda kodu alfabesi. Karisabilen 0 O 1 I harfleri cikarilmistir. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;

export const DEFAULT_BUDGET = 10;
export const DEFAULT_ITEM_LIMIT = 5;
export const DEFAULT_TURN_SECONDS = 30;

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 4;

/** Bu sayidan az takim varsa oylama atlanir, oyun dogrudan biter. */
export const MIN_VOTING_TEAMS = 3;

/** Oda kurulumunda istenen en az urun sayisi (arayuz kurali). */
export const MIN_ITEMS = 5;

/**
 * Oda ayarlarinin kabul edilen araliklari.
 * Hem kurulum formu hem de sunucudaki protokol dogrulamasi bunlari kullanir:
 * arayuzdeki min/max yalnizca bir kolaylik, gecerli sinir burasi.
 */
export const MIN_BUDGET = 1;
export const MAX_BUDGET = 9999;
export const MIN_ITEM_LIMIT = 1;
export const MAX_ITEM_LIMIT = 99;
export const MIN_TURN_SECONDS = 5;
export const MAX_TURN_SECONDS = 300;

/** Tek bir oyunda kabul edilen en fazla urun ve urun adi uzunlugu. */
export const MAX_ITEMS = 200;
export const MAX_ITEM_NAME = 60;
