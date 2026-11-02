import type { ComponentProps } from 'react'

type CardProps = ComponentProps<'div'>

// Shared content padding.
const spacingStyles = 'p-5'

// Card surface, border, and corner radius.
const surfaceStyles = 'rounded-card border border-border bg-surface'

// Default text color and subtle elevation; no hover effects.
const appearanceStyles = 'text-ink shadow-subtle'

const baseStyles = [spacingStyles, surfaceStyles, appearanceStyles].join(' ')

export function Card({ children, className = '', ...props }: CardProps) {
    return (
        <div {...props} className={`${baseStyles} ${className}`}>
            {children}
        </div>
    )
}
