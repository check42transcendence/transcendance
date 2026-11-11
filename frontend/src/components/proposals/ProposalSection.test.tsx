// @vitest-environment jsdom

import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react'
import type { Proposal, VoteDecision } from '@tripcollab/shared'
import { ProposalSection } from './ProposalSection'

const tripId = 'trip-1'
const basePath = `/api/trips/${tripId}/proposals`

const exampleProposal: Proposal = {
    id: 'proposal-1',
    tripId,
    title: 'Visit Louvre',
    description: 'Tuesday afternoon',
    status: 'PENDING',
    createdBy: {
        id: 'user-1',
        username: 'alice',
    },
    createdAt: '2026-11-03T10:00:00.000Z',
    voteSummary: {
        agreeCount: 1,
        rejectCount: 0,
        pendingCount: 1,
        participantCount: 2,
        requiredAgreeCount: 2,
        canAdopt: false,
    },
    currentUserDecision: 'AGREE',
}

const originalDialogMethods = {
    showModal: Object.getOwnPropertyDescriptor(
        HTMLDialogElement.prototype,
        'showModal',
    ),
    close: Object.getOwnPropertyDescriptor(
        HTMLDialogElement.prototype,
        'close',
    ),
}

beforeAll(() => {
    Object.defineProperties(HTMLDialogElement.prototype, {
        showModal: {
            configurable: true,
            value: function (this: HTMLDialogElement) {
                this.open = true
            },
        },
        close: {
            configurable: true,
            value: function (this: HTMLDialogElement) {
                this.open = false
            },
        },
    })
})

afterAll(() => {
    for (const [name, descriptor] of Object.entries(originalDialogMethods)) {
        if (descriptor) {
            Object.defineProperty(HTMLDialogElement.prototype, name, descriptor)
        } else {
            Reflect.deleteProperty(HTMLDialogElement.prototype, name)
        }
    }
})

afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
})

function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

function mockProposalRequests(initial: Proposal[] = []) {
    const saved = [...initial]

    const state = {
        listStatus: 200,
        createStatus: 201,
        detailStatus: 200,
        voteStatus: 200,
        voteGate: null as Promise<void> | null,
    }

    const fakeFetch = vi.fn(
        async (url: string, options?: RequestInit): Promise<Response> => {
            if (url === basePath && options?.method === 'POST') {
                if (state.createStatus !== 201) {
                    return jsonResponse({}, state.createStatus)
                }

                const input = JSON.parse(String(options.body)) as {
                    title: string
                    description: string | null
                }

                const proposal: Proposal = {
                    ...exampleProposal,
                    id: `proposal-${saved.length + 1}`,
                    title: input.title,
                    description: input.description,
                    currentUserDecision: null,
                }

                saved.unshift(proposal)

                return jsonResponse({ proposal }, 201)
            }

            if (
                url.startsWith(`${basePath}/`) &&
                url.endsWith('/vote') &&
                options?.method === 'PUT'
            ) {
                if (state.voteGate) {
                    await state.voteGate
                }

                const proposalId = url.slice(
                    `${basePath}/`.length,
                    -'/vote'.length,
                )

                const index = saved.findIndex(
                    (proposal) => proposal.id === proposalId,
                )

                if (index === -1) {
                    return jsonResponse(
                        {
                            error: {
                                code: 'PROPOSAL_NOT_FOUND',
                                message: 'Proposal not found',
                                details: {},
                            },
                        },
                        404,
                    )
                }

                const previous = saved[index]

                if (state.voteStatus !== 200) {
                    if (state.voteStatus === 409) {
                        saved[index] = {
                            ...previous,
                            status: 'ACCEPTED',
                            voteSummary: {
                                ...previous.voteSummary,
                                canAdopt: false,
                            },
                        }
                    }

                    const errorCode =
                        state.voteStatus === 400
                            ? 'VALIDATION_ERROR'
                            : state.voteStatus === 401
                              ? 'AUTHENTICATION_REQUIRED'
                              : state.voteStatus === 403
                                ? 'MEMBERSHIP_REQUIRED'
                                : state.voteStatus === 404
                                  ? 'PROPOSAL_NOT_FOUND'
                                  : state.voteStatus === 409
                                    ? 'PROPOSAL_VOTING_CLOSED'
                                    : 'INTERNAL_ERROR'

                    return jsonResponse(
                        {
                            error: {
                                code: errorCode,
                                message: 'Vote failed',
                                details: {},
                            },
                        },
                        state.voteStatus,
                    )
                }

                if (previous.status !== 'PENDING') {
                    return jsonResponse(
                        {
                            error: {
                                code: 'PROPOSAL_VOTING_CLOSED',
                                message: 'Proposal voting is closed',
                                details: {},
                            },
                        },
                        409,
                    )
                }

                const input = JSON.parse(String(options.body)) as {
                    decision: VoteDecision
                }

                const agreeCount =
                    previous.voteSummary.agreeCount +
                    (input.decision === 'AGREE' ? 1 : 0) -
                    (previous.currentUserDecision === 'AGREE' ? 1 : 0)

                const rejectCount =
                    previous.voteSummary.rejectCount +
                    (input.decision === 'REJECT' ? 1 : 0) -
                    (previous.currentUserDecision === 'REJECT' ? 1 : 0)

                const participantCount = previous.voteSummary.participantCount

                const updated: Proposal = {
                    ...previous,
                    currentUserDecision: input.decision,
                    voteSummary: {
                        ...previous.voteSummary,
                        agreeCount,
                        rejectCount,
                        pendingCount:
                            participantCount - agreeCount - rejectCount,
                        canAdopt:
                            agreeCount >=
                            previous.voteSummary.requiredAgreeCount,
                    },
                }

                saved[index] = updated

                return jsonResponse({ proposal: updated })
            }

            if (url === basePath && !options?.method) {
                if (state.listStatus !== 200) {
                    return jsonResponse({}, state.listStatus)
                }

                return jsonResponse({ proposals: saved })
            }

            if (url.startsWith(`${basePath}/`) && !options?.method) {
                if (state.detailStatus !== 200) {
                    return jsonResponse(
                        {
                            error: {
                                code: 'PROPOSAL_NOT_FOUND',
                                message: 'Proposal not found',
                                details: {},
                            },
                        },
                        state.detailStatus,
                    )
                }

                const id = url.slice(basePath.length + 1)
                const proposal = saved.find((item) => item.id === id)

                if (!proposal) {
                    return jsonResponse({}, 404)
                }

                return jsonResponse({ proposal })
            }

            throw new Error(
                `Unexpected request: ${options?.method ?? 'GET'} ${url}`,
            )
        },
    )

    vi.stubGlobal('fetch', fakeFetch)

    return { fakeFetch, state }
}

async function openCreateDialog() {
    fireEvent.click(screen.getByRole('button', { name: 'Create proposal' }))

    return screen.getByRole('dialog', {
        name: 'Create a proposal',
    })
}

async function openDetailDialog() {
    await screen.findByText('Visit Louvre')

    fireEvent.click(
        screen.getByRole('button', {
            name: 'View details',
        }),
    )

    const dialog = await screen.findByRole('dialog', {
        name: 'Proposal details',
    })

    await within(dialog).findByText('Tuesday afternoon')

    return dialog
}

describe('ProposalSection', () => {
    it('shows the empty state when there are no Proposals', async () => {
        mockProposalRequests()
        render(<ProposalSection tripId={tripId} />)

        expect(await screen.findByText('No proposals yet')).not.toBeNull()
        expect(
            screen.getByRole('heading', { name: 'Decisions' }),
        ).not.toBeNull()
    })

    it('lists Proposals and loads their details', async () => {
        const { fakeFetch } = mockProposalRequests([exampleProposal])
        render(<ProposalSection tripId={tripId} />)

        expect(await screen.findByText('Visit Louvre')).not.toBeNull()
        expect(screen.getByText(/Created by:\s*alice/)).not.toBeNull()
        expect(screen.getByText('Pending')).not.toBeNull()

        fireEvent.click(screen.getByRole('button', { name: 'View details' }))

        const dialog = await screen.findByRole('dialog', {
            name: 'Proposal details',
        })

        expect(
            await within(dialog).findByText('Tuesday afternoon'),
        ).not.toBeNull()

        expect(within(dialog).getByText('Agree')).not.toBeNull()

        expect(fakeFetch).toHaveBeenCalledWith(`${basePath}/proposal-1`, {
            credentials: 'same-origin',
        })
    })

    it('creates a Proposal and refreshes the list', async () => {
        const { fakeFetch } = mockProposalRequests()
        render(<ProposalSection tripId={tripId} />)

        await screen.findByText('No proposals yet')
        const dialog = await openCreateDialog()

        fireEvent.change(within(dialog).getByLabelText('Proposal title'), {
            target: { value: '  Visit Louvre  ' },
        })

        fireEvent.change(
            within(dialog).getByLabelText('Description (optional)'),
            { target: { value: ' Tuesday afternoon ' } },
        )

        fireEvent.click(
            within(dialog).getByRole('button', {
                name: 'Create proposal',
            }),
        )

        expect(await screen.findByText('Visit Louvre')).not.toBeNull()
        expect(
            screen.queryByRole('dialog', {
                name: 'Create a proposal',
            }),
        ).toBeNull()

        expect(fakeFetch).toHaveBeenCalledWith(
            basePath,
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    title: 'Visit Louvre',
                    description: 'Tuesday afternoon',
                }),
            }),
        )
    })

    it('blocks empty and oversized titles before sending POST', async () => {
        const { fakeFetch } = mockProposalRequests()
        render(<ProposalSection tripId={tripId} />)

        await screen.findByText('No proposals yet')
        const dialog = await openCreateDialog()

        fireEvent.change(within(dialog).getByLabelText('Proposal title'), {
            target: { value: '   ' },
        })

        fireEvent.click(
            within(dialog).getByRole('button', {
                name: 'Create proposal',
            }),
        )

        expect(
            within(dialog).getByText('Please enter a proposal title.'),
        ).not.toBeNull()

        fireEvent.change(within(dialog).getByLabelText('Proposal title'), {
            target: { value: 'x'.repeat(161) },
        })

        fireEvent.click(
            within(dialog).getByRole('button', {
                name: 'Create proposal',
            }),
        )

        expect(
            within(dialog).getByText(
                'Proposal title must not exceed 160 characters.',
            ),
        ).not.toBeNull()

        expect(
            fakeFetch.mock.calls.filter(
                ([, options]) => options?.method === 'POST',
            ),
        ).toHaveLength(0)
    })

    it('preserves form input after a failed creation', async () => {
        const { state } = mockProposalRequests()
        state.createStatus = 500

        render(<ProposalSection tripId={tripId} />)

        await screen.findByText('No proposals yet')
        const dialog = await openCreateDialog()

        fireEvent.change(within(dialog).getByLabelText('Proposal title'), {
            target: { value: 'Visit Louvre' },
        })

        fireEvent.click(
            within(dialog).getByRole('button', {
                name: 'Create proposal',
            }),
        )

        expect((await within(dialog).findByRole('alert')).textContent).toBe(
            'Unable to create the proposal. Please try again.',
        )

        expect(within(dialog).getByDisplayValue('Visit Louvre')).not.toBeNull()

        expect(
            within(dialog)
                .getByRole('button', { name: 'Create proposal' })
                .hasAttribute('disabled'),
        ).toBe(false)
    })

    it('retries the list request after a loading error', async () => {
        const { state } = mockProposalRequests([exampleProposal])
        state.listStatus = 500

        render(<ProposalSection tripId={tripId} />)

        expect((await screen.findByRole('alert')).textContent).toBe(
            'Unable to load proposals. Please try again.',
        )

        state.listStatus = 200

        fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

        expect(await screen.findByText('Visit Louvre')).not.toBeNull()
    })

    it('shows an unavailable message for a missing Proposal', async () => {
        const { state } = mockProposalRequests([exampleProposal])
        state.detailStatus = 404

        render(<ProposalSection tripId={tripId} />)

        await screen.findByText('Visit Louvre')

        fireEvent.click(screen.getByRole('button', { name: 'View details' }))

        const dialog = await screen.findByRole('dialog', {
            name: 'Proposal details',
        })

        expect((await within(dialog).findByRole('alert')).textContent).toBe(
            'This proposal is no longer available.',
        )
    })

    it('casts the first Vote and updates the majority state', async () => {
        const notVoted: Proposal = {
            ...exampleProposal,
            currentUserDecision: null,
        }

        const { fakeFetch } = mockProposalRequests([notVoted])

        render(<ProposalSection tripId={tripId} />)

        const dialog = await openDetailDialog()

        expect(
            within(dialog).getByText('Required majority not yet reached.'),
        ).not.toBeNull()

        fireEvent.click(
            within(dialog).getByRole('button', {
                name: 'Vote agree',
            }),
        )

        await waitFor(() => {
            expect(
                within(dialog)
                    .getByRole('button', { name: 'Vote agree' })
                    .getAttribute('aria-pressed'),
            ).toBe('true')
        })

        expect(
            within(dialog).getByText('Required majority reached.'),
        ).not.toBeNull()

        expect(within(dialog).getByText(/Your vote:/).textContent).toContain(
            'Agree',
        )

        expect(fakeFetch).toHaveBeenCalledWith(
            `${basePath}/proposal-1/vote`,
            expect.objectContaining({
                method: 'PUT',
                body: JSON.stringify({
                    decision: 'AGREE',
                }),
            }),
        )
    })

    it('changes the current Vote and updates statistics', async () => {
        mockProposalRequests([exampleProposal])

        render(<ProposalSection tripId={tripId} />)

        const dialog = await openDetailDialog()

        expect(
            within(dialog)
                .getByRole('button', { name: 'Vote agree' })
                .hasAttribute('disabled'),
        ).toBe(true)

        fireEvent.click(
            within(dialog).getByRole('button', {
                name: 'Vote reject',
            }),
        )

        await waitFor(() => {
            expect(
                within(dialog)
                    .getByRole('button', { name: 'Vote reject' })
                    .getAttribute('aria-pressed'),
            ).toBe('true')
        })

        expect(within(dialog).getByText(/Your vote:/).textContent).toContain(
            'Reject',
        )

        expect(
            within(dialog).getByText('Required majority not yet reached.'),
        ).not.toBeNull()

        expect(
            within(dialog)
                .getByText('Agree')
                .closest('div')
                ?.querySelector('dd')?.textContent,
        ).toBe('0')

        expect(
            within(dialog)
                .getByText('Reject')
                .closest('div')
                ?.querySelector('dd')?.textContent,
        ).toBe('1')
    })

    it('disables voting for ACCEPTED Proposals', async () => {
        const accepted: Proposal = {
            ...exampleProposal,
            status: 'ACCEPTED',
            voteSummary: {
                ...exampleProposal.voteSummary,
                canAdopt: false,
            },
        }

        const { fakeFetch } = mockProposalRequests([accepted])

        render(<ProposalSection tripId={tripId} />)

        const dialog = await openDetailDialog()

        expect(
            within(dialog).getByText('Voting is closed for this proposal.'),
        ).not.toBeNull()

        expect(
            within(dialog)
                .getByRole('button', { name: 'Vote agree' })
                .hasAttribute('disabled'),
        ).toBe(true)

        expect(
            within(dialog)
                .getByRole('button', { name: 'Vote reject' })
                .hasAttribute('disabled'),
        ).toBe(true)

        expect(
            fakeFetch.mock.calls.filter(
                ([, options]) => options?.method === 'PUT',
            ),
        ).toHaveLength(0)
    })

    it('keeps the dialog open during a pending Vote request', async () => {
        const { state, fakeFetch } = mockProposalRequests([exampleProposal])

        let releaseVote!: () => void

        state.voteGate = new Promise<void>((resolve) => {
            releaseVote = resolve
        })

        render(<ProposalSection tripId={tripId} />)

        const dialog = await openDetailDialog()

        fireEvent.click(
            within(dialog).getByRole('button', {
                name: 'Vote reject',
            }),
        )

        await waitFor(() => {
            expect(
                within(dialog).getByText('Saving your vote...'),
            ).not.toBeNull()
        })

        const agreeButton = within(dialog).getByRole('button', {
            name: 'Vote agree',
        })

        const rejectButton = within(dialog).getByRole('button', {
            name: 'Vote reject',
        })

        expect(agreeButton.hasAttribute('disabled')).toBe(true)
        expect(rejectButton.hasAttribute('disabled')).toBe(true)

        // Escape must not close the dialog during a pending Vote.
        const cancelEvent = new Event('cancel', {
            cancelable: true,
        })

        fireEvent(dialog, cancelEvent)

        expect(cancelEvent.defaultPrevented).toBe(true)
        expect((dialog as HTMLDialogElement).open).toBe(true)

        // The dialog has a header X and a footer Close button.
        const closeButtons = within(dialog).getAllByRole('button', {
            name: 'Close',
        })

        expect(closeButtons).toHaveLength(2)

        // Header X must not close the dialog while voting.
        fireEvent.click(closeButtons[0])

        expect((dialog as HTMLDialogElement).open).toBe(true)

        // Footer Close button is disabled while voting.
        expect(closeButtons[1].hasAttribute('disabled')).toBe(true)

        // Complete the pending backend request.
        releaseVote()

        await waitFor(() => {
            expect(
                within(dialog)
                    .getByRole('button', { name: 'Vote reject' })
                    .getAttribute('aria-pressed'),
            ).toBe('true')
        })

        // Only one PUT request was sent.
        expect(
            fakeFetch.mock.calls.filter(
                ([, options]) => options?.method === 'PUT',
            ),
        ).toHaveLength(1)
    })

    it('handles closed voting and refreshes Proposal details', async () => {
        const { state } = mockProposalRequests([exampleProposal])
        state.voteStatus = 409

        render(<ProposalSection tripId={tripId} />)

        const dialog = await openDetailDialog()

        fireEvent.click(
            within(dialog).getByRole('button', {
                name: 'Vote reject',
            }),
        )

        expect(
            await within(dialog).findByText(
                'Voting is closed for this proposal.',
            ),
        ).not.toBeNull()

        expect(
            within(dialog)
                .getByRole('button', { name: 'Vote reject' })
                .hasAttribute('disabled'),
        ).toBe(true)
    })

    it.each([
        [400, 'The vote was rejected as invalid.'],
        [403, 'You no longer have permission to vote in this trip.'],
        [401, 'Please sign in again to vote.'],
        [500, 'Unable to save your vote. Please try again.'],
    ] as const)(
        'shows a useful error message when voting returns HTTP %i',
        async (status, message) => {
            const { state } = mockProposalRequests([exampleProposal])

            state.voteStatus = status

            render(<ProposalSection tripId={tripId} />)

            const dialog = await openDetailDialog()

            fireEvent.click(
                within(dialog).getByRole('button', {
                    name: 'Vote reject',
                }),
            )

            expect((await within(dialog).findByRole('alert')).textContent).toBe(
                message,
            )

            expect(
                within(dialog)
                    .getByRole('button', { name: 'Vote reject' })
                    .hasAttribute('disabled'),
            ).toBe(false)
        },
    )
})
