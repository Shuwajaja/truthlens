import type { Integrity } from "../types.ts"

export function integrityBadge({ verified, integrity }: { verified: boolean; integrity: Integrity }) {
  if (verified === true && integrity === 'hmac') return { variant: 'hmac-geprüft', label: 'HMAC geprüft' } as const
  if (integrity === 'failed') return { variant: 'fehlgeschlagen', label: 'Integritätsprüfung fehlgeschlagen' } as const
  if (integrity === 'hash-only') return { variant: 'nur-hash', label: 'Nur Hash · HMAC nicht geprüft' } as const
  return { variant: 'offen', label: 'HMAC nicht geprüft' } as const
}

