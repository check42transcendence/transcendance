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
    within,
} from '@testing-library/react'
import type { Proposal } from '@tripcollab/shared'
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
})
