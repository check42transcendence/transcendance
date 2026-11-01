import { useState, type SubmitEvent } from 'react'
import { useNavigate } from 'react-router'
import { createTrip } from '../api/trips'
import { PageContainer } from '../components/layout/PageContainer'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Button } from '../components/ui/Button'
import { t } from '../shared/i18n/translation'

// Display the trip creation page.
export function CreateTripPage() {
    const navigate = useNavigate()

    const [title, setTitle] = useState('')
    const [destination, setDestination] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [description, setDescription] = useState('')
    const [validationError, setValidationError] = useState('')
    const [createLoading, setCreateLoading] = useState(false)
    const [createError, setCreateError] = useState('')

    // Validate the form and submit one trip creation request.
    async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (createLoading) {
            return
        }

        setValidationError('')
        setCreateError('')

        const normalizedTitle = title.trim()
        const normalizedDestination = destination.trim()

        if (
            !normalizedTitle ||
            !normalizedDestination ||
            !startDate ||
            !endDate
        ) {
            setValidationError(t('trips.create.validation.required'))
            return
        }

        // Reject reversed dates before calculating the trip duration.
        if (endDate < startDate) {
            setValidationError(t('trips.create.validation.dateRange'))
            return
        }

        // Count both endpoints using UTC dates, matching the backend.
        const start = new Date(`${startDate}T00:00:00.000Z`)
        const end = new Date(`${endDate}T00:00:00.000Z`)
        const millisecondsPerDay = 24 * 60 * 60 * 1000
        const dayCount =
            (end.getTime() - start.getTime()) / millisecondsPerDay + 1

        if (dayCount > 365) {
            setValidationError(t('trips.create.validation.duration'))
            return
        }

        // Submit normalized values and always release the loading state.
        setCreateLoading(true)

        try {
            const createResult = await createTrip({
                title: normalizedTitle,
                destination: normalizedDestination,
                startDate,
                endDate,
                description: description.trim() || null,
            })

            // Open the workspace after the trip is created.
            navigate(`/trips/${createResult.trip.id}`)
        } catch {
            setCreateError(t('trips.create.error'))
        } finally {
            setCreateLoading(false)
        }
    }

    return (
        <PageContainer>
            <h1>{t('trips.create.title')}</h1>

            <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
                <Input
                    label={t('trips.shared.fields.title')}
                    name="title"
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.currentTarget.value)}
                    maxLength={120}
                    required
                />

                <Input
                    label={t('trips.shared.fields.destination')}
                    name="destination"
                    type="text"
                    value={destination}
                    onChange={(event) =>
                        setDestination(event.currentTarget.value)
                    }
                    maxLength={120}
                    required
                />

                <Input
                    label={t('trips.shared.fields.startDate')}
                    name="startDate"
                    type="date"
                    value={startDate}
                    onChange={(event) =>
                        setStartDate(event.currentTarget.value)
                    }
                    required
                />

                <Input
                    label={t('trips.shared.fields.endDate')}
                    name="endDate"
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.currentTarget.value)}
                    required
                />

                <Textarea
                    label={t('trips.shared.fields.description')}
                    name="description"
                    value={description}
                    onChange={(event) =>
                        setDescription(event.currentTarget.value)
                    }
                />

                {/* Announce validation feedback without clearing the entered values. */}
                {validationError && <p role="alert">{validationError}</p>}

                {/* Display request failures while preserving the form values. */}
                {createError && <p role="alert">{createError}</p>}

                <Button
                    type="submit"
                    className="w-full"
                    isLoading={createLoading}
                >
                    {createLoading
                        ? t('trips.create.pending')
                        : t('trips.shared.actions.create')}
                </Button>

                <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    disabled={createLoading}
                    onClick={() => navigate('/home')}
                >
                    {t('common.actions.cancel')}
                </Button>
            </form>
        </PageContainer>
    )
}
