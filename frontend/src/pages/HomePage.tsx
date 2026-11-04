import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getTrips } from '../api/trips'
import type { TripSummary } from '@tripcollab/shared'
import { PageContainer } from '../components/layout/PageContainer'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Card } from '../components/ui/Card'
import { PendingInvitationsSection } from '../components/trips/PendingInvitationsSection'
import { t } from '../shared/i18n/translation'

// Session information and logout controls provided by App.
type HomePageProps = {
    username: string
    onLogout: () => Promise<void>
    logoutLoading?: boolean
    logoutError: string
}

export function HomePage({
    username,
    onLogout,
    logoutLoading,
    logoutError,
}: HomePageProps) {
    // Track trip data, loading progress, and request errors.
    const [trips, setTrips] = useState<TripSummary[]>([])
    const [tripsLoading, setTripsLoading] = useState(true)
    const [tripsError, setTripsError] = useState('')

    // Trigger a fresh trip list after accepting an invitation.
    const [tripsRefreshVersion, setTripsRefreshVersion] = useState(0)

    // Reload trips on mount or after acceptance; ignore outdated results.
    useEffect(() => {
        let active = true

        async function loadTrips(): Promise<void> {
            setTripsLoading(true)
            setTripsError('')

            try {
                const listResult = await getTrips()

                if (active) {
                    setTrips(listResult.trips)
                }
            } catch {
                if (active) {
                    setTripsError(t('trips.home.error'))
                }
            } finally {
                if (active) {
                    setTripsLoading(false)
                }
            }
        }

        void loadTrips()

        return () => {
            active = false
        }
    }, [tripsRefreshVersion])

    return (
        <PageContainer>
            <h1>{t('auth.session.signedIn')}</h1>
            <p>{username}</p>

            {logoutError && <p role="alert">{logoutError}</p>}

            <Button type="button" isLoading={logoutLoading} onClick={onLogout}>
                {logoutLoading
                    ? t('auth.logout.pending')
                    : t('auth.logout.action')}
            </Button>

            <PendingInvitationsSection
                onAccepted={() =>
                    setTripsRefreshVersion((previous) => previous + 1)
                }
            />

            {/* Show the trip list's loading, error, and empty states. */}
            <section className="mt-8">
                <h2>{t('trips.home.title')}</h2>

                {/* Open the trip creation page without reloading the application. */}
                <Link
                    to="/trips/new"
                    className="tc-focus inline-block text-link underline"
                >
                    {t('trips.shared.actions.create')}
                </Link>

                {tripsLoading && <p role="status">{t('trips.home.loading')}</p>}

                {!tripsLoading && tripsError && (
                    <p role="alert">{tripsError}</p>
                )}

                {!tripsLoading && !tripsError && trips.length === 0 && (
                    <EmptyState
                        title={t('trips.home.empty.title')}
                        description={t('trips.home.empty.description')}
                    />
                )}

                {/* Render one card for each trip after a successful load. */}
                {!tripsLoading && !tripsError && trips.length > 0 && (
                    <ul className="mt-4 space-y-4">
                        {trips.map((trip) => (
                            <li key={trip.id}>
                                <Card>
                                    <h3 className="text-card-title font-medium">
                                        <Link
                                            to={`/trips/${trip.id}`}
                                            className="tc-focus text-link underline"
                                        >
                                            {trip.title}
                                        </Link>
                                    </h3>

                                    <p>{trip.destination}</p>

                                    <p className="text-muted">
                                        {trip.startDate} - {trip.endDate}
                                    </p>

                                    <p>
                                        {trip.currentUserRole === 'OWNER'
                                            ? t('trips.shared.roles.owner')
                                            : t('trips.shared.roles.member')}
                                    </p>

                                    {trip.description && (
                                        <p>{trip.description}</p>
                                    )}
                                </Card>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </PageContainer>
    )
}
