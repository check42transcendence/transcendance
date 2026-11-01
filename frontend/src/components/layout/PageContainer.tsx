import type { ReactNode } from 'react'

type PageContainerProps = {
    children: ReactNode
    className?: string
}

// Centers page content and provides consistent width and spacing.
export function PageContainer({
    children,
    className = '',
}: PageContainerProps) {
    return (
        <main className={`mx-auto max-w-[440px] px-4 py-12 ${className}`}>
            {children}
        </main>
    )
}
