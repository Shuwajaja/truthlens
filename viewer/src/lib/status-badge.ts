import type { Integrity } from "../types.ts"

export function integrityBadge({ verified, integrity }: { verified: boolean; integrity: Integrity }) {
  if (verified === true && integrity === 'hmac') return { variant: 'signature-checked', label: 'Signature checked' } as const
  if (integrity === 'failed') return { variant: 'failed', label: 'Integrity check failed' } as const
  if (integrity === 'hash-only') return { variant: 'hash-only', label: 'Hash only · signature not checked' } as const
  return { variant: 'open', label: 'Signature not checked' } as const
}

