import type { Integrity } from '../types.ts'

export function IntegrityNotice({ integrity }: { integrity: Integrity }) {
  const label = integrity === 'hmac' ? 'Integrity: HMAC verified at export'
    : integrity === 'hash-only' ? 'Hash chain only – HMAC not checked'
      : 'Integrity verification failed'
  return (
    <div className="mb-4 text-sm text-[#8b949e]">
      <span className="integrity-badge">{label}</span>
      <p>This browser checks the file's internal consistency only; it does not verify signatures.</p>
    </div>
  )
}
