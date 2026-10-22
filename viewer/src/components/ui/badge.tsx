// Adapted from shadcn/ui (MIT); see LICENSE.shadcn-ui.
import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import type { Claim, Integrity } from '../../types.ts'
import { integrityBadge } from '../../lib/status-badge.ts'
import { cn } from '../../lib/utils.ts'

const badgeVariants = cva('inline-flex w-fit items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium', {
  variants: { variant: {
    outline: 'border-border text-foreground',
    belegt: 'border-ok/40 bg-ok/10 text-ok',
    fehlgeschlagen: 'border-fail/40 bg-fail/10 text-fail',
    offen: 'border-open/40 bg-open/10 text-open',
    'nur-hash': 'border-open/40 bg-open/10 text-open',
    'hmac-geprüft': 'border-ok/40 bg-ok/10 text-ok',
  } },
  defaultVariants: { variant: 'outline' },
})

// Semantic status variants are deliberately private: callers supply exported data instead.
function Badge({ className, ...props }: ComponentProps<'span'>) {
  return <span data-slot="badge" className={cn(badgeVariants(), className)} {...props} />
}


type StatusProps =
  | { source: 'integrity'; verified: boolean; integrity: Integrity }
  | { source: 'criterion'; status: string }
  | { source: 'claim'; finding: Claim['finding'] }

function statusBadge(data: StatusProps): { variant: VariantProps<typeof badgeVariants>['variant']; label: string } {
  if (data.source === 'integrity') return integrityBadge(data)
  if (data.source === 'claim') return { variant: 'offen', label: data.finding === 'supported' ? 'Claim · supported' : 'Claim · claim_unwitnessed' }
  if (data.status === 'met') return { variant: 'belegt', label: 'Belegt' }
  if (data.status === 'unmet') return { variant: 'fehlgeschlagen', label: 'Fehlgeschlagen' }
  return { variant: 'offen', label: 'Offen' }
}

export function StatusBadge(props: StatusProps) {
  const { variant, label } = statusBadge(props)
  return <span data-slot="status-badge" data-variant={variant} className={badgeVariants({ variant })}>
    <span>{label}</span>
    {props.source === 'criterion' && <code className="font-mono">· {props.status}</code>}
  </span>
}

export { Badge }
