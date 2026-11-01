import type { ComponentProps } from 'react'

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

type BadgeProps = ComponentProps<'span'> & { variant?: BadgeVariant }

// Compact shape, spacing, and typography.
const baseStyles =
    'inline-flex items-center rounded-full px-2 py-1 text-small font-medium'

// Subtle status backgrounds with readable dark text.
const variantStyles = {
    neutral: 'bg-surface-secondary text-ink',
    success: 'bg-success/20 text-ink',
    warning: 'bg-warning/20 text-ink',
    danger: 'bg-danger/20 text-ink',
    info: 'bg-info/20 text-ink',
}

// Displays a non-interactive label with a semantic visual variant.
export function Badge({
    children,
    variant = 'neutral',
    className = '',
    ...props
}: BadgeProps) {
    const appearanceStyles = variantStyles[variant]

    return (
        <span
            {...props}
            data-variant={variant}
            className={`${baseStyles} ${appearanceStyles} ${className}`}
        >
            {children}
        </span>
    )
}
