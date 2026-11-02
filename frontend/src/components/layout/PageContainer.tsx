import type { ReactNode } from 'react'

type PageContainerProps = {
    children: ReactNode
    className?: string
    size?: 'compact' | 'wide'
}

// Define the maximum width for each page layout.
const sizeStyles = {
    compact: 'max-w-[440px]',
    wide: 'max-w-[1152px]',
}

// Center page content with a selectable width and consistent spacing.
export function PageContainer({
    children,
    className = '',
    size = 'wide'
}: PageContainerProps) {
    return (
        <main className={`mx-auto ${sizeStyles[size]} px-4 py-12 ${className}`}>
            {children}
        </main>
    )
}
