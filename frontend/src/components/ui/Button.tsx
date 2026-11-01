import type { ComponentProps } from 'react'
import { LoaderCircle } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'danger'

type ButtonProps = ComponentProps<'button'> & {
    variant?: ButtonVariant
    isLoading?: boolean
}

// Position the loading indicator without affecting button dimensions.
const layoutStyles = 'relative inline-flex items-center justify-center'

// Control dimensions, shape, and horizontal padding.
const controlStyles = 'h-control rounded-control border px-5'

// Shared font family, size, and weight.
const typographyStyles = 'font-sans text-small font-medium'

// Color transitions respect the user's reduced-motion preference.
const motionStyles =
    'transition-colors duration-(--tc-duration-fast) motion-reduce:transition-none'

// Keyboard focus and the cursor for non-interactive buttons.
const interactionStyles = 'tc-focus disabled:cursor-not-allowed'

// Keep icons and text aligned while preserving button dimensions.
const contentStyles = 'inline-flex items-center justify-center gap-2'

// Center the loading indicator without affecting content layout.
const loadingOverlayStyles =
    'pointer-events-none absolute inset-0 flex items-center justify-center'

// Respect the user's reduced-motion preference.
const loadingIconStyles = 'motion-safe:animate-spin'

const baseStyles = [
    layoutStyles,
    controlStyles,
    typographyStyles,
    motionStyles,
    interactionStyles,
].join(' ')

const variantStyles = {
    primary: [
        'border-transparent bg-brand text-surface', // Default appearance.
        'enabled:hover:bg-brand-hover', // Hover feedback.
        'enabled:active:bg-brand-pressed', // Pressed feedback.
    ].join(' '),
    secondary: [
        'border-border-control bg-surface text-ink',
        'enabled:hover:bg-surface-secondary',
        'enabled:active:bg-secondary-pressed',
    ].join(' '),
    danger: [
        'border-transparent bg-danger text-surface',
        'enabled:hover:bg-danger-hover',
        'enabled:active:bg-danger-pressed',
    ].join(' '),
}

// Explicitly disabled buttons share one appearance across all variants.
const disabledStyles =
    'border-disabled-border bg-disabled-bg text-disabled-text'

export function Button({
    children,
    type = 'button',
    variant = 'primary',
    isLoading = false,
    disabled = false,
    className = '',
    ...props
}: ButtonProps) {
    const isDisabled = disabled || isLoading
    const appearanceStyles = disabled ? disabledStyles : variantStyles[variant]

    return (
        <button
            {...props}
            type={type}
            disabled={isDisabled}
            aria-busy={isLoading || undefined}
            className={`${baseStyles} ${appearanceStyles} ${className}`}
        >
            <span
                className={`${contentStyles} ${isLoading ? 'opacity-0' : ''}`}
            >
                {children}
            </span>
            {isLoading && (
                <span aria-hidden="true" className={loadingOverlayStyles}>
                    <LoaderCircle size={16} className={loadingIconStyles} />
                </span>
            )}
        </button>
    )
}
