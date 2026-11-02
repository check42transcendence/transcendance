import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Select } from '../components/ui/Select'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { Tabs } from '../components/ui/Tabs'
import { Toast } from '../components/ui/Toast'

const buttonVariants = ['primary', 'secondary', 'danger'] as const
const badgeVariants = [
    'neutral',
    'success',
    'warning',
    'danger',
    'info',
] as const
const toastVariants = ['success', 'warning', 'danger', 'info'] as const
const exampleText = 'A shared travel plan for our next trip.'
const longText = Array.from({ length: 12 }, () => exampleText).join('\n')

// Shared layout classes for the preview only.
const sectionStyles = 'space-y-5'
const headingStyles = 'text-section-title font-medium'
const gridStyles = 'grid gap-5 sm:grid-cols-2'
const hintStyles = 'text-small text-muted'

// Previews all shared UI components without authentication or API requests.
export function UiPreview() {
    const [description, setDescription] = useState('')
    const [transport, setTransport] = useState('')
    const [modalExample, setModalExample] = useState<
        'basic' | 'footer' | 'long' | null
    >(null)
    const [activeTab, setActiveTab] = useState('overview')
    const [emptyActionDone, setEmptyActionDone] = useState(false)
    const [visibleSamples, setVisibleSamples] = useState<string[]>([
        ...toastVariants,
    ])
    const [toastOpen, setToastOpen] = useState(false)
    const [toastVariant, setToastVariant] =
        useState<(typeof toastVariants)[number]>('info')
    const [autoCloseMs, setAutoCloseMs] = useState(0)
    const [notificationCount, setNotificationCount] = useState(0)

    // Shows a new floating notification and restarts its optional timer.
    function showToast(variant: (typeof toastVariants)[number], duration = 0) {
        setToastVariant(variant)
        setAutoCloseMs(duration)
        setNotificationCount((count) => count + 1)
        setToastOpen(true)
    }

    return (
        <main className="mx-auto max-w-5xl space-y-8 px-4 py-12 text-ink">
            <header className="space-y-2">
                <h1 className="text-page-title font-medium">UI Preview</h1>
                <p className={hintStyles}>
                    Shared component variants and states. No backend is
                    required. Hover, hold a button, or use Tab to inspect
                    interactive styles.
                </p>
            </header>

            {/* Shows every button variant in its normal, loading, and disabled states. */}
            <Card className={sectionStyles}>
                <h2 className={headingStyles}>Button</h2>
                {buttonVariants.map((variant) => (
                    <div key={variant} className="space-y-2">
                        <h3 className="font-medium capitalize">{variant}</h3>
                        <div className="flex flex-wrap items-center gap-3">
                            <Button variant={variant}>Normal</Button>
                            <Button variant={variant} isLoading>
                                Loading
                            </Button>
                            <Button variant={variant} disabled>
                                Disabled
                            </Button>
                            <Button variant={variant} isLoading disabled>
                                Disabled + loading
                            </Button>
                            <Button variant={variant}>
                                <Plus
                                    size={20}
                                    strokeWidth={2}
                                    aria-hidden="true"
                                />
                                With icon
                            </Button>
                            <Button
                                variant={variant}
                                aria-label={`Add item (${variant})`}
                            >
                                <Plus
                                    size={20}
                                    strokeWidth={2}
                                    aria-hidden="true"
                                />
                            </Button>
                        </div>
                    </div>
                ))}
                <p className={hintStyles}>
                    Use the examples below for actions with visible results.
                </p>
            </Card>

            {/* Compares editable, invalid, read-only, and disabled fields. */}
            <Card className={sectionStyles}>
                <h2 className={headingStyles}>Input</h2>
                <div className={gridStyles}>
                    <Input label="Empty" placeholder="Enter a destination" />
                    <Input label="With value" defaultValue="Paris" />
                    <Input
                        label="Error"
                        defaultValue="wrong-email"
                        error="Please enter a valid email."
                    />
                    <Input label="Read-only" value="Paris" readOnly />
                    <Input
                        label="Disabled"
                        defaultValue="Unavailable destination"
                        disabled
                    />
                    <Input
                        label="Disabled placeholder"
                        placeholder="Not available"
                        disabled
                    />
                    <Input
                        label="Password"
                        type="password"
                        defaultValue="example-password"
                    />
                </div>
            </Card>

            <Card className={sectionStyles}>
                <h2 className={headingStyles}>Textarea</h2>
                <div className={gridStyles}>
                    <Textarea
                        label="Empty (default 4 rows)"
                        placeholder="Describe your trip"
                    />
                    <div className="space-y-2">
                        <Textarea
                            label="Controlled value"
                            value={description}
                            placeholder="Type to update the value below"
                            onChange={(event) =>
                                setDescription(event.currentTarget.value)
                            }
                        />
                        <p className={`${hintStyles} break-words`}>
                            Current value: {description || '(empty)'}
                        </p>
                    </div>
                    <Textarea label="Error" error="Please add a description." />
                    <Textarea label="Read-only" value={exampleText} readOnly />
                    <Textarea
                        label="Disabled"
                        defaultValue={exampleText}
                        disabled
                    />
                    <Textarea
                        label="Disabled placeholder"
                        placeholder="Not available"
                        disabled
                    />
                    <Textarea
                        label="Long content (scroll inside)"
                        defaultValue={longText}
                    />
                    <Textarea
                        label="Custom height (2 rows)"
                        rows={2}
                        defaultValue={exampleText}
                    />
                </div>
            </Card>

            <Card className={sectionStyles}>
                <h2 className={headingStyles}>Select</h2>
                <div className={gridStyles}>
                    <div className="space-y-2">
                        <Select
                            label="Placeholder and controlled selection"
                            value={transport}
                            onChange={(event) =>
                                setTransport(event.currentTarget.value)
                            }
                        >
                            <option value="" disabled>
                                Choose transport
                            </option>
                            <option value="train">Train</option>
                            <option value="bus">Bus</option>
                        </Select>
                        <p className={hintStyles}>
                            Current value: {transport || '(none)'}
                        </p>
                    </div>
                    <Select label="With selection" defaultValue="train">
                        <option value="train">Train</option>
                        <option value="bus">Bus</option>
                    </Select>
                    <Select
                        label="Error"
                        defaultValue=""
                        error="Please choose a transport option."
                    >
                        <option value="" disabled>
                            Choose transport
                        </option>
                        <option value="train">Train</option>
                        <option value="bus">Bus</option>
                    </Select>
                    <Select label="Disabled" defaultValue="train" disabled>
                        <option value="train">Train</option>
                        <option value="bus">Bus</option>
                    </Select>
                </div>
                <p className={hintStyles}>
                    The browser and operating system control the expanded menu.
                    Select has no read-only state.
                </p>
            </Card>

            {/* Displays every semantic badge color and basic card composition. */}
            <Card className={sectionStyles}>
                <h2 className={headingStyles}>Badge</h2>
                <div className="flex flex-wrap gap-3">
                    {badgeVariants.map((variant) => (
                        <Badge
                            key={variant}
                            variant={variant}
                            className="capitalize"
                        >
                            {variant}
                        </Badge>
                    ))}
                </div>
                <p className={hintStyles}>
                    Badges are labels, not clickable controls.
                </p>
            </Card>

            <section className={sectionStyles}>
                <h2 className={headingStyles}>Card</h2>
                <div className={gridStyles}>
                    <Card>
                        Simple content with the default padding, border, and
                        shadow.
                    </Card>
                    <Card className="space-y-3">
                        <h3 className="font-medium">Weekend in Paris</h3>
                        <p className={hintStyles}>
                            A card can contain text, badges, and action buttons.
                        </p>
                        <Badge variant="info">Planning</Badge>
                        <div>
                            <Button
                                variant="secondary"
                                onClick={() => showToast('info')}
                            >
                                Example action
                            </Button>
                        </div>
                    </Card>
                </div>
            </section>

            <Card className={sectionStyles}>
                <h2 className={headingStyles}>EmptyState</h2>
                <div className={gridStyles}>
                    <Card>
                        <EmptyState title="No results" />
                    </Card>
                    <Card>
                        <EmptyState
                            title="No proposals"
                            description="New proposals will appear here."
                        />
                    </Card>
                    <Card>
                        <EmptyState
                            title="No trips yet"
                            description="Create your first trip to get started."
                            action={
                                <Button
                                    onClick={() => setEmptyActionDone(true)}
                                >
                                    Create example trip
                                </Button>
                            }
                        />
                        {emptyActionDone && (
                            <p role="status" className={hintStyles}>
                                Example action clicked. No trip was created.
                            </p>
                        )}
                    </Card>
                </div>
            </Card>

            {/* Opens real dialogs to demonstrate dismissal, footers, and scrolling. */}
            <Card className={sectionStyles}>
                <h2 className={headingStyles}>Modal</h2>
                <div className="flex flex-wrap gap-3">
                    <Button onClick={() => setModalExample('basic')}>
                        Basic modal
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => setModalExample('footer')}
                    >
                        Modal with footer
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => setModalExample('long')}
                    >
                        Long content
                    </Button>
                </div>
                <p className={hintStyles}>
                    Try Escape, the close button, Tab navigation, and focus
                    returning to the opener. Clicking the backdrop does not
                    close the dialog.
                </p>
            </Card>
            <Modal
                open={modalExample !== null}
                onClose={() => setModalExample(null)}
                title={
                    modalExample === 'long'
                        ? 'Long content example'
                        : 'Example modal'
                }
                footer={
                    modalExample === 'footer' ? (
                        <>
                            <Button
                                variant="secondary"
                                onClick={() => setModalExample(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => {
                                    setModalExample(null)
                                    showToast('success')
                                }}
                            >
                                Confirm
                            </Button>
                        </>
                    ) : undefined
                }
            >
                {modalExample === 'long' ? (
                    <div className="space-y-4">
                        {Array.from({ length: 20 }, (_, index) => (
                            <p key={index}>
                                Section {index + 1}. {exampleText}
                            </p>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p>This dialog is controlled by the preview page.</p>
                        <Input
                            label="Example field"
                            placeholder="Try keyboard navigation"
                        />
                    </div>
                )}
            </Modal>

            <Card className={sectionStyles}>
                <h2 className={headingStyles}>Tabs</h2>
                <p className={hintStyles}>
                    Click a tab or use the left/right arrows. Tab enters the
                    selected tab and then moves to the panel. Hidden panels
                    preserve their input values.
                </p>
                <Tabs
                    label="Example trip sections"
                    value={activeTab}
                    onValueChange={setActiveTab}
                    items={[
                        {
                            value: 'overview',
                            label: 'Overview',
                            content: <p>This is the overview panel.</p>,
                        },
                        {
                            value: 'members',
                            label: 'Members',
                            content: (
                                <EmptyState
                                    title="No members yet"
                                    description="Invite your travel companions."
                                />
                            ),
                        },
                        {
                            value: 'notes',
                            label: 'Notes',
                            content: (
                                <Textarea
                                    label="Trip notes"
                                    placeholder="Type here, switch tabs, then return"
                                />
                            ),
                        },
                    ]}
                />
            </Card>

            {/* Keeps color samples in the page; real floating behavior is shown below. */}
            <Card className={sectionStyles}>
                <h2 className={headingStyles}>Toast</h2>
                <p className={hintStyles}>
                    All four colors are shown below. These samples stay open
                    until dismissed.
                </p>
                <div className={gridStyles}>
                    {toastVariants.map((variant) => (
                        <div key={variant} className="space-y-2">
                            <h3 className="font-medium capitalize">
                                {variant}
                            </h3>
                            <div className="[&>div]:static [&>div]:w-full [&>div]:max-w-none">
                                <Toast
                                    open={visibleSamples.includes(variant)}
                                    message={`${variant}: example notification.`}
                                    variant={variant}
                                    onClose={() =>
                                        setVisibleSamples((current) =>
                                            current.filter(
                                                (item) => item !== variant,
                                            ),
                                        )
                                    }
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <Button
                    variant="secondary"
                    onClick={() => setVisibleSamples([...toastVariants])}
                >
                    Reset color samples
                </Button>
                <h3 className="font-medium">Floating notification</h3>
                <div className="flex flex-wrap gap-3">
                    {toastVariants.map((variant) => (
                        <Button
                            key={variant}
                            variant="secondary"
                            onClick={() => showToast(variant)}
                        >
                            Show {variant}
                        </Button>
                    ))}
                    <Button onClick={() => showToast('success', 5000)}>
                        Auto-close after 5 seconds
                    </Button>
                </div>
                <p className={hintStyles}>
                    A new floating message replaces the previous one. Each click
                    updates the message. Only the five-second example closes
                    automatically.
                </p>
            </Card>
            <Toast
                open={toastOpen}
                message={`${toastVariant}: example notification ${notificationCount}.`}
                variant={toastVariant}
                onClose={() => setToastOpen(false)}
                autoCloseMs={autoCloseMs}
            />
        </main>
    )
}
