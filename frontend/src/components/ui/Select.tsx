import { useId, type ComponentProps } from 'react'
import { ChevronDown } from 'lucide-react'

type SelectProps = ComponentProps<'select'> & {
    label: string
    error?: string
}

// Label, control, and error message layout.
const fieldLayoutStyles = 'flex flex-col gap-2'
const labelStyles = 'text-small font-medium text-ink'
const errorMessageStyles = 'text-small text-danger'

// Single-line height and spacing, with room for the custom arrow.
const controlStyles =
    'h-control w-full appearance-none rounded-control border pl-3 pr-10'

// Uses muted text for a selected placeholder and normal text for valid options.
const appearanceStyles = [
    'text-body bg-surface text-ink',
    'enabled:has-[option:checked:disabled]:text-muted',
    '[&_option:enabled]:text-ink',
].join(' ')

// Keyboard focus and color transitions; no hover background change.
const interactionStyles =
    'tc-focus transition-colors duration-(--tc-duration-fast) motion-reduce:transition-none'

// Disabled controls use shared colors and a non-interactive cursor.
const disabledStyles = [
    'disabled:cursor-not-allowed disabled:bg-disabled-bg',
    'disabled:text-disabled-text disabled:border-disabled-border',
].join(' ')

const baseStyles = [
    controlStyles,
    appearanceStyles,
    interactionStyles,
    disabledStyles,
].join(' ')

// Validation colors remain separate from the shared control styles.
const normalStyles = 'border-border-control focus:border-brand'
const errorStyles = 'border-danger focus-visible:outline-danger'

// Displays a labeled native select control.
export function Select({
    children,
    label,
    error,
    id,
    className = '',
    ...props
}: SelectProps) {
    const generatedId = useId()
    const selectId = id ?? generatedId
    const errorId = `${selectId}-error`
    const validationStyles = error ? errorStyles : normalStyles

    const describedBy =
        [props['aria-describedby'], error ? errorId : undefined]
            .filter(Boolean)
            .join(' ') || undefined

    return (
        <div className={fieldLayoutStyles}>
            <label htmlFor={selectId} className={labelStyles}>
                {label}
            </label>

            <div className="relative">
                <select
                    {...props}
                    id={selectId}
                    aria-invalid={error ? true : props['aria-invalid']}
                    aria-describedby={describedBy}
                    className={`${baseStyles} ${validationStyles} ${className}`}
                >
                    {children}
                </select>

                <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${
                        props.disabled ? 'text-disabled-text' : 'text-muted'
                    }`}
                />
            </div>

            {error && (
                <p id={errorId} className={errorMessageStyles}>
                    {error}
                </p>
            )}
        </div>
    )
}
