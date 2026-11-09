import { useEffect, useState } from 'react'
import type { PendingInvitation } from '@tripcollab/shared'
import {
    getPendingInvitations,
    acceptInvitation,
    rejectInvitation,
} from '../../api/membership'
import { ApiError } from '../../lib/http/api-error'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { Button } from '../ui/Button'
import { t } from '../../shared/i18n/translation'

type PendingInvitationsSectionProps = {
    // Ask Home to reload My Trips after a successful acceptance.
    onAccepted: () => void
}

// Display invitations awaiting the current user's decision.
export function PendingInvitationsSection({
    onAccepted,
}: PendingInvitationsSectionProps) {
    // Track pending invitations, loading progress, and request errors.
    const [invitations, setInvitations] = useState<PendingInvitation[]>([])
    const [invitationsLoading, setInvitationsLoading] = useState(true)
    const [invitationsError, setInvitationsError] = useState('')

    // Reload invitations after acceptance or a manual refresh.
    const [invitationsRefreshVersion, setInvitationsRefreshVersion] =
        useState(0)

    // Track each invitation's pending action and error independently.
    const [pendingActions, setPendingActions] = useState<
        Record<string, 'accept' | 'reject' | undefined>
    >({})
    const [decisionErrors, setDecisionErrors] = useState<
        Record<string, string | undefined>
    >({})

    // Reload invitations when requested and ignore outdated results.
    useEffect(() => {
        let active = true

        async function loadInvitation(): Promise<void> {
            setInvitationsLoading(true)
            setInvitationsError('')

            try {
                const invitationsResult = await getPendingInvitations()

                if (active) {
                    setInvitations(invitationsResult.invitations)
                }
            } catch {
                if (active) {
                    setInvitationsError(t('membership.pending.error'))
                }
            } finally {
                if (active) {
                    setInvitationsLoading(false)
                }
            }
        }

        void loadInvitation()

        return () => {
            active = false
        }
    }, [invitationsRefreshVersion])

    // Resolve one invitation and preserve it when the request fails.
    async function handleInvitationDecision(
        invitationId: string,
        action: 'accept' | 'reject',
    ): Promise<void> {
        if (pendingActions[invitationId]) return

        // Update this invitation without clearing other pending actions.
        setPendingActions((previous) => ({
            ...previous,
            [invitationId]: action,
        }))
        setDecisionErrors((previous) => ({
            ...previous,
            [invitationId]: undefined,
        }))

        try {
            if (action === 'accept') {
                await acceptInvitation(invitationId)
            } else {
                await rejectInvitation(invitationId)
            }

            // Remove the invitation only after the backend confirms success.
            setInvitations((previous) =>
                previous.filter((invitation) => invitation.id !== invitationId),
            )

            // Refresh both lists because acceptance creates a membership.
            if (action === 'accept') {
                onAccepted()
                setInvitationsRefreshVersion((previous) => previous + 1)
            }
        } catch (error) {
            // Explain stale invitations separately from temporary failures.
            const unavailable =
                error instanceof ApiError &&
                (error.code === 'INVITATION_NOT_FOUND' ||
                    error.code === 'INVITATION_NOT_PENDING')

            setDecisionErrors((previous) => ({
                ...previous,
                [invitationId]: unavailable
                    ? t('membership.pending.unavailable')
                    : t('membership.pending.decisionError'),
            }))
        } finally {
            setPendingActions((previous) => ({
                ...previous,
                [invitationId]: undefined,
            }))
        }
    }

    return (
        <section className="mt-8">
            <h2 className="text-card-title font-medium">
                {t('membership.pending.title')}
            </h2>

            {invitationsLoading && (
                <p role="status">{t('membership.pending.loading')}</p>
            )}

            {!invitationsLoading && invitationsError && (
                <p role="alert">{invitationsError}</p>
            )}

            {!invitationsLoading &&
                !invitationsError &&
                invitations.length === 0 && (
                    <EmptyState title={t('membership.pending.empty')} />
                )}

            {!invitationsLoading &&
                !invitationsError &&
                invitations.length > 0 && (
                    <ul className="mt-3 space-y-3">
                        {invitations.map((invitation) => (
                            <li key={invitation.id}>
                                <Card className="space-y-2 wrap-break-word">
                                    <h3 className="text-card-title font-medium">
                                        {invitation.trip.title}
                                    </h3>

                                    <p>{invitation.trip.destination}</p>

                                    <p className="text-muted">
                                        {invitation.trip.startDate}
                                        {' - '}
                                        {invitation.trip.endDate}
                                    </p>

                                    <p>
                                        {t('membership.pending.invitedBy')}:{' '}
                                        {invitation.invitedBy.username}
                                    </p>

                                    <div className="flex gap-3">
                                        <Button
                                            type="button"
                                            isLoading={
                                                pendingActions[
                                                    invitation.id
                                                ] === 'accept'
                                            }
                                            disabled={
                                                pendingActions[
                                                    invitation.id
                                                ] === 'reject'
                                            }
                                            onClick={() => {
                                                void handleInvitationDecision(
                                                    invitation.id,
                                                    'accept',
                                                )
                                            }}
                                        >
                                            {t('membership.pending.accept')}
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="secondary"
                                            isLoading={
                                                pendingActions[
                                                    invitation.id
                                                ] === 'reject'
                                            }
                                            disabled={
                                                pendingActions[
                                                    invitation.id
                                                ] === 'accept'
                                            }
                                            onClick={() => {
                                                void handleInvitationDecision(
                                                    invitation.id,
                                                    'reject',
                                                )
                                            }}
                                        >
                                            {t('membership.pending.reject')}
                                        </Button>
                                    </div>

                                    {decisionErrors[invitation.id] && (
                                        <div className="space-y-2">
                                            <p
                                                role="alert"
                                                className="text-danger"
                                            >
                                                {decisionErrors[invitation.id]}
                                            </p>

                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={() => {
                                                    setInvitationsRefreshVersion(
                                                        (previous) =>
                                                            previous + 1,
                                                    )
                                                }}
                                            >
                                                {t(
                                                    'membership.pending.refresh',
                                                )}
                                            </Button>
                                        </div>
                                    )}
                                </Card>
                            </li>
                        ))}
                    </ul>
                )}
        </section>
    )
}
