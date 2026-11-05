import { useState, useEffect, useId } from 'react'
import { useNavigate } from 'react-router'
import {
    getTripMembers,
    leaveTrip,
    createTripInvitation,
} from '../../api/membership'
import { ApiError } from '../../lib/http/api-error'
import type { MembershipRole, TripMember } from '@tripcollab/shared'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
import { Input } from '../ui/Input'
import { t } from '../../shared/i18n/translation'

type TripMembersSectionProps = {
    tripId: string
    currentUserRole: MembershipRole
}

// Display the trip's members and membership actions.
export function TripMembersSection({
    tripId,
    currentUserRole,
}: TripMembersSectionProps) {
    const navigate = useNavigate()
    const inviteFormId = useId()

    // Track members, loading progress, and request errors.
    const [members, setMembers] = useState<TripMember[]>([])
    const [membersLoading, setMembersLoading] = useState(true)
    const [membersError, setMembersError] = useState('')

    const [leaveOpen, setLeaveOpen] = useState(false)
    const [leaveLoading, setLeaveLoading] = useState(false)
    const [leaveError, setLeaveError] = useState('')

    const [inviteOpen, setInviteOpen] = useState(false)
    const [inviteLoading, setInviteLoading] = useState(false)
    const [inviteError, setInviteError] = useState('')
    const [inviteSuccess, setInviteSuccess] = useState('')
    const [inviteBy, setInviteBy] = useState<'username' | 'email'>('username')
    const [inviteIdentifier, setInviteIdentifier] = useState('')

    // Load members again when the trip changes.
    useEffect(() => {
        let active = true

        async function loadMembers(): Promise<void> {
            setMembersLoading(true)
            setMembersError('')
            setMembers([])

            try {
                const membersResult = await getTripMembers(tripId)

                if (active) {
                    setMembers(membersResult.members)
                }
            } catch {
                if (active) {
                    setMembersError(t('membership.error'))
                }
            } finally {
                if (active) {
                    setMembersLoading(false)
                }
            }
        }

        void loadMembers()

        return () => {
            active = false
        }
    }, [tripId])

    // Return home only after the backend confirms successful leave.
    async function handleLeaveTrip(): Promise<void> {
        if (currentUserRole !== 'MEMBER' || leaveLoading) {
            return
        }

        setLeaveLoading(true)
        setLeaveError('')

        try {
            await leaveTrip(tripId)
            navigate('/home', { replace: true })
        } catch {
            setLeaveError(t('membership.leave.error'))
        } finally {
            setLeaveLoading(false)
        }
    }

    // Keep the confirmation open while leaving the trip.
    function closeLeaveDialog(): void {
        if (leaveLoading) return

        setLeaveOpen(false)
        setLeaveError('')
    }

    // Send exactly one identifier and preserve input when the request fails.
    async function handleInviteMember(): Promise<void> {
        if (currentUserRole !== 'OWNER' || inviteLoading) {
            return
        }

        const identifier = inviteIdentifier.trim()

        setInviteError('')
        setInviteSuccess('')

        if (!identifier) {
            setInviteError(t('membership.invite.required'))
            return
        }

        setInviteLoading(true)

        try {
            const input =
                inviteBy === 'email'
                    ? { email: identifier }
                    : { username: identifier }

            await createTripInvitation(tripId, input)

            setInviteSuccess(t('membership.invite.success'))
            setInviteIdentifier('')
        } catch (error) {
            if (error instanceof ApiError) {
                switch (error.code) {
                    case 'INVITEE_NOT_FOUND':
                        setInviteError(t('membership.invite.userNotFound'))
                        break

                    case 'INVITATION_ALREADY_PENDING':
                        setInviteError(t('membership.invite.alreadyPending'))
                        break

                    case 'MEMBERSHIP_ALREADY_EXISTS':
                        setInviteError(t('membership.invite.alreadyMember'))
                        break

                    default:
                        setInviteError(t('membership.invite.error'))
                }
            } else {
                setInviteError(t('membership.invite.error'))
            }
        } finally {
            setInviteLoading(false)
        }
    }

    // Keep the invitation open while sending and clear it after closing.
    function closeInviteDialog(): void {
        if (inviteLoading) return

        setInviteOpen(false)
        setInviteIdentifier('')
        setInviteError('')
        setInviteSuccess('')
    }

    return (
        <section className="mt-6">
            <h2 className="text-card-title font-medium">
                {t('membership.title')}
            </h2>

            {membersLoading && <p role="status">{t('membership.loading')}</p>}

            {!membersLoading && membersError && (
                <p role="alert">{membersError}</p>
            )}

            {!membersLoading && !membersError && members.length === 0 && (
                <p>{t('membership.empty')}</p>
            )}

            {!membersLoading && !membersError && members.length > 0 && (
                <ul className="mt-3 space-y-3">
                    {members.map((member) => (
                        <li key={member.user.id}>
                            <Card>
                                <p className="wrap-break-word">
                                    {member.user.username}
                                </p>
                                <p>
                                    {member.role === 'OWNER'
                                        ? t('trips.shared.roles.owner')
                                        : t('trips.shared.roles.member')}
                                </p>
                            </Card>
                        </li>
                    ))}
                </ul>
            )}

            {/* owner invite member */}
            {currentUserRole === 'OWNER' && (
                <>
                    <Button
                        type="button"
                        className="mt-4"
                        onClick={() => setInviteOpen(true)}
                    >
                        {t('membership.invite.action')}
                    </Button>

                    <Modal
                        open={inviteOpen}
                        onClose={closeInviteDialog}
                        title={t('membership.invite.title')}
                        footer={
                            <>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={inviteLoading}
                                    onClick={closeInviteDialog}
                                >
                                    {t('common.actions.cancel')}
                                </Button>

                                <Button
                                    type="submit"
                                    form={inviteFormId}
                                    isLoading={inviteLoading}
                                >
                                    {t('membership.invite.action')}
                                </Button>
                            </>
                        }
                    >
                        <p>{t('membership.invite.description')}</p>

                        <form
                            id={inviteFormId}
                            className="mt-4 space-y-4"
                            onSubmit={(event) => {
                                event.preventDefault()
                                void handleInviteMember()
                            }}
                        >
                            <Select
                                label={t('membership.invite.method')}
                                name="inviteBy"
                                value={inviteBy}
                                onChange={(event) => {
                                    setInviteBy(
                                        event.currentTarget.value === 'email'
                                            ? 'email'
                                            : 'username',
                                    )
                                    setInviteIdentifier('')
                                    setInviteError('')
                                    setInviteSuccess('')
                                }}
                                disabled={inviteLoading}
                            >
                                <option value="username">
                                    {t('membership.invite.byUsername')}
                                </option>
                                <option value="email">
                                    {t('membership.invite.byEmail')}
                                </option>
                            </Select>

                            <Input
                                label={
                                    inviteBy === 'email'
                                        ? t('membership.invite.byEmail')
                                        : t('membership.invite.byUsername')
                                }
                                name="inviteIdentifier"
                                type={inviteBy === 'email' ? 'email' : 'text'}
                                value={inviteIdentifier}
                                onChange={(event) => {
                                    setInviteIdentifier(
                                        event.currentTarget.value,
                                    )
                                    setInviteError('')
                                    setInviteSuccess('')
                                }}
                                disabled={inviteLoading}
                                required
                            />

                            {inviteError && (
                                <p role="alert" className="text-danger">
                                    {inviteError}
                                </p>
                            )}

                            {inviteSuccess && (
                                <p role="status">{inviteSuccess}</p>
                            )}
                        </form>
                    </Modal>
                </>
            )}

            {/* Allow member to leave the trip. */}
            {currentUserRole === 'MEMBER' && (
                <>
                    <Button
                        type="button"
                        variant="danger"
                        className="mt-4"
                        onClick={() => setLeaveOpen(true)}
                    >
                        {t('membership.leave.action')}
                    </Button>

                    <Modal
                        open={leaveOpen}
                        onClose={closeLeaveDialog}
                        title={t('membership.leave.title')}
                        footer={
                            <>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={leaveLoading}
                                    onClick={closeLeaveDialog}
                                >
                                    {t('common.actions.cancel')}
                                </Button>

                                <Button
                                    type="button"
                                    variant="danger"
                                    isLoading={leaveLoading}
                                    onClick={handleLeaveTrip}
                                >
                                    {t('membership.leave.action')}
                                </Button>
                            </>
                        }
                    >
                        <p>{t('membership.leave.description')}</p>

                        {leaveError && (
                            <p role="alert" className="mt-3 text-danger">
                                {leaveError}
                            </p>
                        )}
                    </Modal>
                </>
            )}
        </section>
    )
}
