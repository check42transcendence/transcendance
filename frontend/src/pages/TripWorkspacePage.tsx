import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router'
import { ApiError } from '../lib/http/api-error'
import { getTrip, getTripDays, deleteTrip } from '../api/trips'
import type { TripDetail, ItineraryDay } from '@tripcollab/shared'
import { PageContainer } from '../components/layout/PageContainer'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { TripMembersSection } from '../components/trips/TripMembersSection'
import { t } from '../shared/i18n/translation'
import { ProposalSection } from '../components/proposals/ProposalSection'

// Load and display the current trip workspace.
export function TripWorkspacePage() {
    const params = useParams()
    const tripId = params.tripId
    const navigate = useNavigate()

    // Track trip details, loading progress, and request errors.
    const [trip, setTrip] = useState<TripDetail | null>(null)
    const [tripLoading, setTripLoading] = useState(true)
    const [tripError, setTripError] = useState('')

    const [days, setDays] = useState<ItineraryDay[]>([])

    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [deleteError, setDeleteError] = useState('')

    // Load trip details when the route's trip ID changes.
    useEffect(() => {
        let active = true

        async function loadTrip(): Promise<void> {
            setTripLoading(true)
            setTripError('')
            setTrip(null)
            setDays([])
            setDeleteOpen(false)
            setDeleteError('')

            try {
                if (!tripId) {
                    throw new Error('Missing trip Id')
                }

                const detailsResult = await getTrip(tripId)
                const daysResult = await getTripDays(tripId)

                if (active) {
                    setTrip(detailsResult.trip)
                    setDays(daysResult.days)
                }
            } catch (error) {
                if (!active) return

                if (
                    error instanceof ApiError &&
                    error.code === 'TRIP_NOT_FOUND'
                ) {
                    setTripError(t('trips.workspace.unavailable'))
                } else {
                    setTripError(t('trips.workspace.error'))
                }
            } finally {
                if (active) {
                    setTripLoading(false)
                }
            }
        }

        void loadTrip()

        return () => {
            active = false
        }
    }, [tripId])

    // Return home only after the backend confirms successful deletion.
    async function handleDeleteTrip(): Promise<void> {
        if (!trip || trip.currentUserRole !== 'OWNER' || deleteLoading) {
            return
        }

        setDeleteLoading(true)
        setDeleteError('')

        try {
            await deleteTrip(trip.id)
            navigate('/home', { replace: true })
        } catch {
            setDeleteError(t('trips.workspace.delete.error'))
        } finally {
            setDeleteLoading(false)
        }
    }

    // Keep the confirmation open while deletion is in progress.
    function closeDeleteDialog(): void {
        if (deleteLoading) return

        setDeleteOpen(false)
        setDeleteError('')
    }

    return (
        <PageContainer>
            <h1>{t('trips.workspace.title')}</h1>

            <Link
                to="/home"
                className="tc-focus mt-3 inline-block text-link underline"
            >
                {t('trips.shared.actions.backToHome')}
            </Link>

            {tripLoading && <p role="status">{t('trips.workspace.loading')}</p>}

            {!tripLoading && tripError && <p role="alert">{tripError}</p>}

            {!tripLoading && !tripError && trip && (
                <Card className="mt-6 space-y-3 wrap-break-word">
                    <h2 className="text-card-title font-medium">
                        {trip.title}
                    </h2>

                    <p>
                        {t('trips.shared.fields.destination')}:{' '}
                        {trip.destination}
                    </p>

                    <p>
                        {t('trips.shared.fields.startDate')}: {trip.startDate}
                    </p>

                    <p>
                        {t('trips.shared.fields.endDate')}: {trip.endDate}
                    </p>

                    <p>
                        {trip.currentUserRole === 'OWNER'
                            ? t('trips.shared.roles.owner')
                            : t('trips.shared.roles.member')}
                    </p>

                    {trip.description && (
                        <p className="whitespace-pre-wrap">
                            {trip.description}
                        </p>
                    )}

                    {trip.currentUserRole === 'OWNER' && (
                        <>
                            <Button
                                type="button"
                                variant="danger"
                                onClick={() => setDeleteOpen(true)}
                            >
                                {t('trips.workspace.delete.action')}
                            </Button>

                            <Modal
                                open={deleteOpen}
                                onClose={closeDeleteDialog}
                                title={t('trips.workspace.delete.title')}
                                footer={
                                    <>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            disabled={deleteLoading}
                                            onClick={closeDeleteDialog}
                                        >
                                            {t('common.actions.cancel')}
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="danger"
                                            isLoading={deleteLoading}
                                            onClick={handleDeleteTrip}
                                        >
                                            {deleteLoading
                                                ? t(
                                                      'trips.workspace.delete.pending',
                                                  )
                                                : t(
                                                      'trips.workspace.delete.action',
                                                  )}
                                        </Button>
                                    </>
                                }
                            >
                                <p>{t('trips.workspace.delete.description')}</p>

                                {deleteError && (
                                    <p
                                        role="alert"
                                        className="mt-3 text-danger"
                                    >
                                        {deleteError}
                                    </p>
                                )}
                            </Modal>
                        </>
                    )}
                </Card>
            )}

            {!tripLoading && !tripError && trip && (
                <section className="mt-6">
                    <h2 className="text-card-title font-medium">
                        {t('trips.workspace.days.title')}
                    </h2>

                    <ol className="mt-3 space-y-3">
                        {days.map((day) => (
                            <li key={day.id}>
                                <Card>
                                    <p>
                                        {t('trips.workspace.days.day')}{' '}
                                        {day.dayNumber}
                                    </p>
                                    <p className="text-muted">{day.date}</p>
                                </Card>
                            </li>
                        ))}
                    </ol>
                </section>
            )}

            {/* Show Proposals only when the current Trip is accessible. */}
            {!tripLoading && !tripError && trip && (
                <ProposalSection key={trip.id} tripId={trip.id} />
            )}

            {/* Show the members area only after the trip loads successfully. */}
            {!tripLoading && !tripError && trip && (
                <TripMembersSection
                    tripId={trip.id}
                    currentUserRole={trip.currentUserRole}
                />
            )}
        </PageContainer>
    )
}
