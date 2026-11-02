import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'

type TabItem = {
    value: string
    label: string
    content: ReactNode
}

type TabsProps = {
    label: string
    items: TabItem[]
    value: string
    onValueChange: (value: string) => void
}

// Horizontal tab list with a shared bottom border.
const tabListStyles = 'flex gap-1 border-b border-border'

// Shared spacing, typography, and keyboard focus.
const tabStyles =
    'tc-focus rounded-t-control border-b-2 px-4 py-2 text-small font-medium'

// Selected and unselected tab appearances.
const activeTabStyles = 'border-brand text-brand'
const inactiveTabStyles =
    'border-transparent text-muted hover:bg-surface-secondary hover:text-ink'

// Displays controlled tabs and their associated content panels.
export function Tabs({ label, items, value, onValueChange }: TabsProps) {
    const tabsId = useId()
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

    // Moves focus and selection between tabs with the arrow keys.
    function handleKeyDown(
        event: KeyboardEvent<HTMLButtonElement>,
        index: number,
    ) {
        let nextIndex: number

        if (event.key === 'ArrowRight') {
            nextIndex = (index + 1) % items.length
        } else if (event.key === 'ArrowLeft') {
            nextIndex = (index - 1 + items.length) % items.length
        } else {
            return
        }

        event.preventDefault()

        tabRefs.current[nextIndex]?.focus()
        onValueChange(items[nextIndex].value)
    }

    return (
        <div>
            <div role="tablist" aria-label={label} className={tabListStyles}>
                {items.map((item, index) => (
                    <button
                        key={item.value}
                        type="button"
                        role="tab"
                        id={`${tabsId}-tab-${index}`}
                        aria-selected={item.value === value}
                        aria-controls={`${tabsId}-panel-${index}`}
                        tabIndex={item.value === value ? 0 : -1}
                        ref={(element) => {
                            tabRefs.current[index] = element
                        }}
                        onKeyDown={(event) => handleKeyDown(event, index)}
                        className={`${tabStyles} ${
                            item.value === value
                                ? activeTabStyles
                                : inactiveTabStyles
                        }`}
                        onClick={() => onValueChange(item.value)}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {items.map((item, index) => (
                <div
                    key={item.value}
                    role="tabpanel"
                    id={`${tabsId}-panel-${index}`}
                    aria-labelledby={`${tabsId}-tab-${index}`}
                    hidden={item.value !== value}
                    tabIndex={0}
                    className="tc-focus pt-4"
                >
                    {item.content}
                </div>
            ))}
        </div>
    )
}
