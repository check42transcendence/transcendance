import type { ReactNode } from 'react'

type EmptyStateProps = {
    title: string
    description?: string
    action?: ReactNode
    className?: string
}

// Centers the title, description, and optional action.
const containerStyles = 'flex flex-col items-center gap-3 px-4 py-8 text-center'

export function EmptyState({
    title,
    description,
    action,
    className = '',
}: EmptyStateProps) {
    return (
        <div className={`${containerStyles} ${className}`}>
            <h2 className="text-card-title font-medium">{title}</h2>

            {description && (
                <p className="max-w-prose text-muted">{description}</p>
            )}

            {action && <div className="mt-2">{action}</div>}
        </div>
    )
}
