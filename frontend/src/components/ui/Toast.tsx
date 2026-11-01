import { useEffect, useEffectEvent } from 'react'
import { X } from 'lucide-react'
import { t } from '../../shared/i18n/translation'

type ToastVariant = 'success' | 'warning' | 'danger' | 'info'

type ToastProps = {
    open: boolean
    message: string
    onClose: () => void
    variant?: ToastVariant
    autoCloseMs?: number
}

// Keeps the notification near the bottom-right corner.
const positionStyles = 'fixed bottom-4 right-4 z-50 w-[90vw] max-w-sm'

// Notification surface, spacing, and alignment.
const toastStyles =
    'flex items-start gap-3 rounded-control border bg-surface p-4 text-ink shadow-subtle'

// Dismiss button size, focus, and hover appearance.
const closeStyles =
    'tc-focus inline-flex h-control w-control shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface-secondary'

// Semantic border colors; the message also describes the result.
const variantStyles = {
    success: 'border-success',
    warning: 'border-warning',
    danger: 'border-danger',
    info: 'border-info',
}

export function Toast({
    open,
    message,
    onClose,
    variant = 'info',
    autoCloseMs = 0,
}: ToastProps) {
    // Calls the latest close handler from the timer.
    const closeFromTimer = useEffectEvent(() => {
        onClose()
    })

    // Automatically closes the toast when a duration is provided.
    useEffect(() => {
        if (!open || autoCloseMs <= 0) {
            return
        }

        const timeoutId = window.setTimeout(() => {
            closeFromTimer()
        }, autoCloseMs)

        return () => {
            window.clearTimeout(timeoutId)
        }
    }, [open, message, autoCloseMs])

    const appearanceStyles = open
        ? `${toastStyles} ${variantStyles[variant]}`
        : ''

    return (
        <div className={`${positionStyles} ${appearanceStyles}`}>
            <div
                role={variant === 'danger' ? 'alert' : 'status'}
                aria-atomic="true"
                className="min-w-0 flex-1 wrap-break-word text-small"
            >
                {open ? message : ''}
            </div>

            {open && (
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={t('common.actions.close')}
                    className={closeStyles}
                >
                    <X size={20} strokeWidth={2} aria-hidden="true" />
                </button>
            )}
        </div>
    )
}
