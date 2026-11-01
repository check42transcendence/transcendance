import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { t } from '../../shared/i18n/translation'

type ModalProps = {
    open: boolean
    onClose: () => void
    title: string
    children: ReactNode
    footer?: ReactNode
}

// Centers the dialog and keeps long content within the viewport.
const dialogStyles = [
    'm-auto w-[90vw] max-w-lg max-h-[90dvh] overflow-y-auto',
    'rounded-modal border-0 bg-surface p-6 text-ink shadow-modal',
    'backdrop:bg-ink/40',
].join(' ')

// Close button dimensions, focus, and hover appearance.
const closeStyles =
    'tc-focus inline-flex h-control w-control shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface-secondary'

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const titleId = useId()

    // Synchronizes the native dialog with the parent's open state.
    useEffect(() => {
        const dialog = dialogRef.current
        if (!dialog) return

        if (open && !dialog.open) {
            dialog.showModal()
        } else if (!open && dialog.open) {
            dialog.close()
        }
    }, [open])

    return (
        <dialog
            ref={dialogRef}
            aria-labelledby={titleId}
            onCancel={(event) => {
                event.preventDefault()
                onClose()
            }}
            className={dialogStyles}
        >
            <header className="flex items-start justify-between gap-4">
                <h2
                    id={titleId}
                    className="min-w-0 wrap-break-word text-section-title font-medium"
                >
                    {title}
                </h2>

                <button
                    type="button"
                    onClick={onClose}
                    aria-label={t('common.actions.close')}
                    className={closeStyles}
                >
                    <X size={20} strokeWidth={2} aria-hidden="true" />
                </button>
            </header>

            <div className="mt-4">{children}</div>

            {footer && (
                <div className="mt-6 flex flex-wrap justify-end gap-3">
                    {footer}
                </div>
            )}
        </dialog>
    )
}
