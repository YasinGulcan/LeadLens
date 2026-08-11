const TRIAL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface TrialInfo {
  /** Negatif/0 olabilir — süre dolduysa isExpired true, daysLeft anlamsızlaşır. */
  daysLeft: number;
  isExpired: boolean;
  /** Süre dolmadı ama 3 gün ya da altı kaldı — rozet uyarı rengine dönsün diye. */
  isEndingSoon: boolean;
}

/** Tamamen görsel/algısal bir "14 gün ücretsiz deneme" hissiyatı — gerçek bir kısıtlama/kilitleme tetiklemiyor. Ayrı bir DB alanı yok, accounts.created_at'ten her seferinde hesaplanıyor. */
export function getTrialInfo(createdAt: string): TrialInfo {
  const trialEndMs = new Date(createdAt).getTime() + TRIAL_DAYS * DAY_MS;
  const daysLeft = Math.ceil((trialEndMs - Date.now()) / DAY_MS);
  return {
    daysLeft,
    isExpired: daysLeft <= 0,
    isEndingSoon: daysLeft > 0 && daysLeft <= 3,
  };
}
