import { useEffect, useId, useState, type SubmitEvent } from 'react'
import type { Proposal, VoteDecision } from '@tripcollab/shared'

import {
    createProposal,
    getProposal,
    getProposals,
    voteProposal,
} from '../../api/proposals'

import { ApiError } from '../../lib/http/api-error'
import { t } from '../../shared/i18n/translation'

import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Textarea } from '../ui/Textarea'

type ProposalSectionProps = {
    tripId: string
}

// Show Proposal status using the project's shared Badge component.
function ProposalStatusBadge({ status }: { status: Proposal['status'] }) {
    return (
        <Badge variant={status === 'ACCEPTED' ? 'success' : 'neutral'}>
            {status === 'ACCEPTED'
                ? t('proposals.status.accepted')
                : t('proposals.status.pending')}
        </Badge>
    )
}

export function ProposalSection({ tripId }: ProposalSectionProps) {
    const formId = useId()

    // Proposal list state.
    const [proposals, setProposals] = useState<Proposal[]>([])
    const [listLoading, setListLoading] = useState(true)
    const [listError, setListError] = useState('')
    const [reloadVersion, setReloadVersion] = useState(0)

    // Creation form state.
    const [createOpen, setCreateOpen] = useState(false)
    const [createLoading, setCreateLoading] = useState(false)
    const [createError, setCreateError] = useState('')
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')

    // Detail dialog state.
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [detail, setDetail] = useState<Proposal | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [detailError, setDetailError] = useState('')
    const [detailVersion, setDetailVersion] = useState(0)
    // Voting request state.
    const [voteLoading, setVoteLoading] = useState(false)
    const [voteError, setVoteError] = useState('')

    // Load Proposals whenever the Trip changes or a refresh is requested.
    useEffect(() => {
        let active = true

        async function loadProposals(): Promise<void> {
            setListLoading(true)
            setListError('')
            setProposals([])

            try {
                const result = await getProposals(tripId)

                if (active) {
                    setProposals(result.proposals)
                }
            } catch {
                if (active) {
                    setListError(t('proposals.list.error'))
                }
            } finally {
                if (active) {
                    setListLoading(false)
                }
            }
        }

        void loadProposals()

        return () => {
            active = false
        }
    }, [tripId, reloadVersion])

    // Load detail only when the user opens a Proposal.
    useEffect(() => {
        if (!selectedId) return

        let active = true

        async function loadDetail(): Promise<void> {
            setDetail(null)
            setDetailLoading(true)
            setDetailError('')

            try {
                const result = await getProposal(tripId, selectedId!)

                if (active) {
                    setDetail(result.proposal)
                }
            } catch (error) {
                if (active) {
                    setDetailError(
                        error instanceof ApiError &&
                            error.code === 'PROPOSAL_NOT_FOUND'
                            ? t('proposals.detail.unavailable')
                            : t('proposals.detail.error'),
                    )
                }
            } finally {
                if (active) {
                    setDetailLoading(false)
                }
            }
        }

        void loadDetail()

        return () => {
            active = false
        }
    }, [tripId, selectedId, detailVersion])

    function closeCreate(): void {
        if (createLoading) return

        setCreateOpen(false)
        setTitle('')
        setDescription('')
        setCreateError('')
    }

    function closeDetail(): void {
        if (voteLoading) return

        setSelectedId(null)
        setDetail(null)
        setDetailLoading(false)
        setDetailError('')
        setVoteError('')
    }

    async function handleVote(decision: VoteDecision): Promise<void> {
        if (
            voteLoading ||
            !selectedId ||
            !detail ||
            detail.id !== selectedId ||
            detail.status !== 'PENDING' ||
            detail.currentUserDecision === decision
        ) {
            return
        }

        const proposalId = selectedId

        setVoteLoading(true)
        setVoteError('')

        try {
            const result = await voteProposal(tripId, proposalId, {
                decision,
            })

            // The backend response is authoritative.
            setDetail(result.proposal)

            // Keep the list consistent with the updated detail.
            setProposals((current) =>
                current.map((proposal) =>
                    proposal.id === proposalId ? result.proposal : proposal,
                ),
            )
        } catch (error) {
            if (error instanceof ApiError) {
                switch (error.code) {
                    case 'VALIDATION_ERROR':
                        setVoteError(t('proposals.vote.invalid'))
                        break

                    case 'PROPOSAL_VOTING_CLOSED':
                        setVoteError(t('proposals.vote.closedConflict'))
                        setDetailVersion((version) => version + 1)
                        break

                    case 'PROPOSAL_NOT_FOUND':
                        setVoteError(t('proposals.vote.unavailable'))
                        setDetailVersion((version) => version + 1)
                        break

                    case 'TRIP_NOT_FOUND':
                    case 'MEMBERSHIP_REQUIRED':
                    case 'ACCESS_DENIED':
                        setVoteError(t('proposals.vote.permission'))
                        break

                    case 'AUTHENTICATION_REQUIRED':
                        setVoteError(t('proposals.vote.session'))
                        break

                    default:
                        setVoteError(t('proposals.vote.error'))
                }
            } else {
                setVoteError(t('proposals.vote.error'))
            }
        } finally {
            setVoteLoading(false)
        }
    }

    async function handleCreate(
        event: SubmitEvent<HTMLFormElement>,
    ): Promise<void> {
        event.preventDefault()

        if (createLoading) return

        setCreateError('')

        const normalizedTitle = title.trim()

        if (!normalizedTitle) {
            setCreateError(t('proposals.create.validation.required'))
            return
        }

        if (normalizedTitle.length > 160) {
            setCreateError(t('proposals.create.validation.maxLength'))
            return
        }

        setCreateLoading(true)

        try {
            await createProposal(tripId, {
                title: normalizedTitle,
                description: description.trim() || null,
            })

            setCreateOpen(false)
            setTitle('')
            setDescription('')

            // Reload from the backend to preserve canonical list ordering.
            setReloadVersion((version) => version + 1)
        } catch (error) {
            if (
                error instanceof ApiError &&
                error.code === 'VALIDATION_ERROR'
            ) {
                setCreateError(t('proposals.create.validation.invalid'))
            } else if (
                error instanceof ApiError &&
                error.code === 'TRIP_NOT_FOUND'
            ) {
                setCreateError(t('proposals.create.unavailable'))
            } else {
                setCreateError(t('proposals.create.error'))
            }
        } finally {
            setCreateLoading(false)
        }
    }

    return (
        <section className="mt-6 space-y-4">
            <div>
                <h2 className="text-section-title font-medium">
                    {t('proposals.decisions.title')}
                </h2>
                <p className="mt-1 text-muted">
                    {t('proposals.decisions.description')}
                </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-card-title font-medium">
                    {t('proposals.list.title')}
                </h3>

                <Button type="button" onClick={() => setCreateOpen(true)}>
                    {t('proposals.create.action')}
                </Button>
            </div>

            {listLoading && <p role="status">{t('proposals.list.loading')}</p>}

            {!listLoading && listError && (
                <div className="space-y-3">
                    <p role="alert">{listError}</p>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                            setReloadVersion((version) => version + 1)
                        }
                    >
                        {t('common.actions.retry')}
                    </Button>
                </div>
            )}

            {!listLoading && !listError && proposals.length === 0 && (
                <EmptyState
                    title={t('proposals.list.empty.title')}
                    description={t('proposals.list.empty.description')}
                />
            )}

            {!listLoading && !listError && proposals.length > 0 && (
                <ul className="space-y-3">
                    {proposals.map((proposal) => (
                        <li key={proposal.id}>
                            <Card className="space-y-3 wrap-break-word">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <h4 className="font-medium">
                                        {proposal.title}
                                    </h4>
                                    <ProposalStatusBadge
                                        status={proposal.status}
                                    />
                                </div>

                                <p className="text-small text-muted">
                                    {t('proposals.fields.creator')}:{' '}
                                    {proposal.createdBy.username}
                                </p>

                                <p className="text-small text-muted">
                                    {t('proposals.fields.createdAt')}:{' '}
                                    <time dateTime={proposal.createdAt}>
                                        {proposal.createdAt.slice(0, 10)}
                                    </time>
                                </p>

                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => {
                                        setSelectedId(proposal.id)
                                    }}
                                >
                                    {t('proposals.detail.action')}
                                </Button>
                            </Card>
                        </li>
                    ))}
                </ul>
            )}

            <Modal
                open={createOpen}
                onClose={closeCreate}
                title={t('proposals.create.title')}
                footer={
                    <>
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={createLoading}
                            onClick={closeCreate}
                        >
                            {t('common.actions.cancel')}
                        </Button>
                        <Button
                            type="submit"
                            form={formId}
                            isLoading={createLoading}
                        >
                            {t('proposals.create.action')}
                        </Button>
                    </>
                }
            >
                <form
                    id={formId}
                    noValidate
                    className="space-y-4"
                    onSubmit={(event) => void handleCreate(event)}
                >
                    <Input
                        label={t('proposals.fields.title')}
                        name="title"
                        value={title}
                        onChange={(event) => {
                            setTitle(event.currentTarget.value)
                            setCreateError('')
                        }}
                        disabled={createLoading}
                        required
                    />

                    <Textarea
                        label={t('proposals.fields.description')}
                        name="description"
                        value={description}
                        onChange={(event) => {
                            setDescription(event.currentTarget.value)
                            setCreateError('')
                        }}
                        disabled={createLoading}
                    />

                    {createError && (
                        <p role="alert" className="text-danger">
                            {createError}
                        </p>
                    )}
                </form>
            </Modal>

            <Modal
                open={selectedId !== null}
                onClose={closeDetail}
                title={t('proposals.detail.title')}
                footer={
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={voteLoading}
                        onClick={closeDetail}
                    >
                        {t('common.actions.close')}
                    </Button>
                }
            >
                {detailLoading && (
                    <p role="status">{t('proposals.detail.loading')}</p>
                )}

                {!detailLoading && detailError && (
                    <div className="space-y-3">
                        <p role="alert">{detailError}</p>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                                setDetailVersion((version) => version + 1)
                            }
                        >
                            {t('common.actions.retry')}
                        </Button>
                    </div>
                )}

                {!detailLoading && !detailError && detail && (
                    <div className="space-y-3 wrap-break-word">
                        <h3 className="text-card-title font-medium">
                            {detail.title}
                        </h3>

                        <ProposalStatusBadge status={detail.status} />

                        <p className="whitespace-pre-wrap">
                            {detail.description ??
                                t('proposals.detail.noDescription')}
                        </p>

                        <p>
                            {t('proposals.fields.creator')}:{' '}
                            {detail.createdBy.username}
                        </p>

                        <p>
                            {t('proposals.fields.createdAt')}:{' '}
                            <time dateTime={detail.createdAt}>
                                {detail.createdAt.slice(0, 10)}
                            </time>
                        </p>

                        <h4 className="font-medium">
                            {t('proposals.detail.votes')}
                        </h4>

                        <dl className="grid grid-cols-2 gap-3 text-small">
                            <div>
                                <dt>{t('proposals.votes.agree')}</dt>
                                <dd>{detail.voteSummary.agreeCount}</dd>
                            </div>
                            <div>
                                <dt>{t('proposals.votes.reject')}</dt>
                                <dd>{detail.voteSummary.rejectCount}</dd>
                            </div>
                            <div>
                                <dt>{t('proposals.votes.pending')}</dt>
                                <dd>{detail.voteSummary.pendingCount}</dd>
                            </div>
                            <div>
                                <dt>{t('proposals.votes.participants')}</dt>
                                <dd>{detail.voteSummary.participantCount}</dd>
                            </div>
                            <div>
                                <dt>{t('proposals.votes.required')}</dt>
                                <dd>{detail.voteSummary.requiredAgreeCount}</dd>
                            </div>
                        </dl>

                        <p>
                            {t('proposals.votes.yours')}:{' '}
                            {detail.currentUserDecision === 'AGREE'
                                ? t('proposals.votes.agree')
                                : detail.currentUserDecision === 'REJECT'
                                  ? t('proposals.votes.reject')
                                  : t('proposals.votes.notVoted')}
                        </p>

                        <p className="text-small text-muted">
                            {detail.status === 'ACCEPTED'
                                ? t('proposals.vote.closed')
                                : detail.voteSummary.canAdopt
                                  ? t('proposals.vote.majorityReached')
                                  : t('proposals.vote.majorityPending')}
                        </p>

                        <div className="space-y-2">
                            <h4 className="font-medium">
                                {t('proposals.vote.title')}
                            </h4>

                            <div className="flex flex-wrap gap-3">
                                <Button
                                    type="button"
                                    variant={
                                        detail.currentUserDecision === 'AGREE'
                                            ? 'primary'
                                            : 'secondary'
                                    }
                                    aria-pressed={
                                        detail.currentUserDecision === 'AGREE'
                                    }
                                    disabled={
                                        voteLoading ||
                                        detail.status !== 'PENDING' ||
                                        detail.currentUserDecision === 'AGREE'
                                    }
                                    onClick={() => void handleVote('AGREE')}
                                >
                                    {t('proposals.vote.agree')}
                                </Button>

                                <Button
                                    type="button"
                                    variant={
                                        detail.currentUserDecision === 'REJECT'
                                            ? 'primary'
                                            : 'secondary'
                                    }
                                    aria-pressed={
                                        detail.currentUserDecision === 'REJECT'
                                    }
                                    disabled={
                                        voteLoading ||
                                        detail.status !== 'PENDING' ||
                                        detail.currentUserDecision === 'REJECT'
                                    }
                                    onClick={() => void handleVote('REJECT')}
                                >
                                    {t('proposals.vote.reject')}
                                </Button>
                            </div>

                            {voteLoading && (
                                <p role="status">
                                    {t('proposals.vote.submitting')}
                                </p>
                            )}
                        </div>

                        {voteError && (
                            <p role="alert" className="text-danger">
                                {voteError}
                            </p>
                        )}
                    </div>
                )}
            </Modal>
        </section>
    )
}
