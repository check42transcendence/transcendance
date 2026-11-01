import { useId, type ComponentProps } from 'react'

type TextareaProps = ComponentProps<'textarea'> & {
    label: string
    error?: string
}

// Label, control, and error message layout.
const fieldLayoutStyles = 'flex flex-col gap-2'
const labelStyles = 'text-small font-medium text-ink'
const errorMessageStyles = 'text-small text-danger'

// Minimum height, shape, and spacing; manual resizing is disabled.
const controlStyles =
    'min-h-control w-full resize-none rounded-control border px-3 py-2'

// Default surface, entered text, and placeholder text.
const appearanceStyles = 'text-body bg-surface text-ink placeholder:text-muted'

// Keyboard focus and color transitions; no hover background change.
const interactionStyles =
    'tc-focus transition-colors duration-(--tc-duration-fast) motion-reduce:transition-none'

// Read-only fields remain focusable and use a distinct background.
const readOnlyStyles = 'enabled:read-only:bg-surface-secondary'

// Disabled fields use explicit colors rather than reduced opacity.
const disabledStyles = [
    'disabled:cursor-not-allowed disabled:bg-disabled-bg',
    'disabled:text-disabled-text disabled:border-disabled-border',
    'disabled:placeholder:text-disabled-text',
].join(' ')

// Validation colors remain separate from the shared control styles.
const normalStyles = 'border-border-control focus:border-brand'
const errorStyles = 'border-danger focus-visible:outline-danger'

const baseStyles = [
    controlStyles,
    appearanceStyles,
    interactionStyles,
    readOnlyStyles,
    disabledStyles,
].join(' ')

// Displays a labeled multiline text input.
export function Textarea({
    label,
    error,
    id,
    rows = 4,
    className = '',
    ...props
}: TextareaProps) {
    const generatedId = useId()
    const textareaId = id ?? generatedId
    const errorId = `${textareaId}-error`
    const validationStyles = error ? errorStyles : normalStyles

    const describedBy =
        [props['aria-describedby'], error ? errorId : undefined]
            .filter(Boolean)
            .join(' ') || undefined

    return (
        <div className={fieldLayoutStyles}>
            <label htmlFor={textareaId} className={labelStyles}>
                {label}
            </label>

            <textarea
                {...props}
                rows={rows}
                id={textareaId}
                aria-invalid={error ? true : props['aria-invalid']}
                aria-describedby={describedBy}
                className={`${baseStyles} ${validationStyles} ${className}`}
            />

            {error && (
                <p id={errorId} className={errorMessageStyles}>
                    {error}
                </p>
            )}
        </div>
    )
}
