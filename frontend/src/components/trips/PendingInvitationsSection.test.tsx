// @vitest-environment jsdom

import { afterEach, expect, it, vi } from 'vitest'
import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    within,
    waitFor,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { PendingInvitation, TripSummary } from '@tripcollab/shared'
import { PendingInvitationsSection } from './PendingInvitationsSection'
import { HomePage } from '../../pages/HomePage'

// Two invitations let tests check that actions stay local to one card.
const invitations: PendingInvitation[] = [
    {
        id: 'invitation-a',
        status: 'PENDING',
        trip: {
            id: 'trip-a',
            title: 'Paris weekend',
            destination: 'Paris',
            startDate: '2026-11-14',
            endDate: '2026-11-15',
        },
        invitedBy: { id: 'owner-a', username: 'paris-owner' },
        createdAt: '2026-11-04T10:00:00.000Z',
    },
    {
        id: 'invitation-b',
        status: 'PENDING',
        trip: {
            id: 'trip-b',
            title: 'Winter holiday',
            destination: 'Lyon',
            startDate: '2026-12-20',
            endDate: '2026-12-23',
        },
        invitedBy: { id: 'owner-b', username: 'lyon-owner' },
        createdAt: '2026-11-04T11:00:00.000Z',
    },
]
const listPath = '/api/invitations?status=PENDING'

// Build a fresh response so separate requests can read their own bodies.
function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

// Return the shared error envelope for simulated backend failures.
function errorResponse(code: string, status: number): Response {
    return jsonResponse(
        { error: { code, message: 'Request failed', details: {} } },
        status,
    )
}

type RequestOptions = {
    initialInvitations?: PendingInvitation[]
    listStatus?: number
    getInvitations?: () => PendingInvitation[]
    decisionResponse?: (id: string, action: string) => Promise<Response>
}

// Simulate independent invitation and Trip endpoints, not a response queue.
function mockInvitationRequests({
    initialInvitations = invitations,
    listStatus = 200,
    getInvitations,
    decisionResponse,
}: RequestOptions = {}) {
    let serverInvitations = [...initialInvitations]
    const joinedTrips: TripSummary[] = []
    const fakeFetch = vi.fn(async (url: string, options?: RequestInit) => {
        if (url === listPath && !options?.method) {
            return listStatus === 200
                ? jsonResponse({
                      invitations: getInvitations
                          ? getInvitations()
                          : serverInvitations,
                  })
                : errorResponse('INTERNAL_ERROR', listStatus)
        }
        if (url === '/api/trips' && !options?.method)
            return jsonResponse({ trips: joinedTrips })
        const decision = /^\/api\/invitations\/([^/]+)\/(accept|reject)$/.exec(
            url,
        )
        if (decision && options?.method === 'POST') {
            const [, id, action] = decision
            const response = decisionResponse
                ? await decisionResponse(id, action)
                : new Response(null, { status: 204 })
            if (response.ok) {
                const invitation = serverInvitations.find(
                    (item) => item.id === id,
                )
                serverInvitations = serverInvitations.filter(
                    (item) => item.id !== id,
                )
                if (action === 'accept' && invitation)
                    joinedTrips.push({
                        ...invitation.trip,
                        description: null,
                        currentUserRole: 'MEMBER',
                    })
            }
            return response
        }
        throw new Error(
            `Unexpected test request: ${options?.method ?? 'GET'} ${url}`,
        )
    })
    vi.stubGlobal('fetch', fakeFetch)
    return fakeFetch
}

// Render the section alone when Home behavior is not under test.
function renderInvitations() {
    return render(<PendingInvitationsSection onAccepted={vi.fn()} />)
}

// Render the real Home so acceptance must trigger its actual Trip reload.
function renderHome() {
    return render(
        <MemoryRouter initialEntries={['/home']}>
            <HomePage
                username="invitee"
                onLogout={vi.fn().mockResolvedValue(undefined)}
                logoutError=""
            />
        </MemoryRouter>,
    )
}

// Scope assertions to invitations, away from My Trips with matching titles.
function pendingSection() {
    const section = screen
        .getByRole('heading', { name: 'Pending invitations' })
        .closest('section')
    if (!section) throw new Error('Pending invitations section is missing')
    return within(section)
}

// Locate one invitation card by its Trip title.
function invitationCard(title = invitations[0].trip.title) {
    const card = pendingSection()
        .getByRole('heading', { name: title })
        .closest('li')
    if (!card) throw new Error(`Invitation card is missing: ${title}`)
    return within(card)
}

// Keep test pages and simulated requests isolated.
afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
})

// Display public summaries without treating an invitation as Workspace access.
it('loads invitation summaries without Workspace links', async () => {
    const fakeFetch = mockInvitationRequests()
    renderInvitations()
    expect(screen.getByRole('status').textContent).toBe(
        'Loading invitations...',
    )
    await screen.findByRole('heading', { name: 'Paris weekend' })
    expect(invitationCard().getByText('Paris')).not.toBeNull()
    expect(invitationCard().getByText('2026-11-14 - 2026-11-15')).not.toBeNull()
    expect(invitationCard().getByText('Invited by: paris-owner')).not.toBeNull()
    expect(
        invitationCard('Winter holiday').getByText('Invited by: lyon-owner'),
    ).not.toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
    expect(fakeFetch).toHaveBeenCalledWith(listPath, {
        credentials: 'same-origin',
    })
})

// Distinguish an empty successful result from a failed request.
it('shows an empty state when there are no pending invitations', async () => {
    mockInvitationRequests({ initialInvitations: [] })
    renderInvitations()
    await screen.findByRole('heading', { name: 'No pending invitations.' })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull()
})

// Do not disguise a loading failure as an empty invitation list.
it('shows a request error instead of an empty state', async () => {
    mockInvitationRequests({ listStatus: 500 })
    renderInvitations()
    expect((await screen.findByRole('alert')).textContent).toBe(
        'Unable to load invitations. Please try again.',
    )
    expect(
        screen.queryByRole('heading', { name: 'No pending invitations.' }),
    ).toBeNull()
})

// Block both actions on one pending card, then refresh Home and invitations.
it('accepts an invitation and refreshes both lists on Home', async () => {
    let resolveDecision!: (response: Response) => void
    const pendingDecision = new Promise<Response>((resolve) => {
        resolveDecision = resolve
    })
    const fakeFetch = mockInvitationRequests({
        decisionResponse: () => pendingDecision,
    })
    renderHome()
    await screen.findByRole('heading', { name: 'Paris weekend' })
    await screen.findByRole('heading', { name: 'No trips yet' })
    expect(screen.queryByRole('link', { name: 'Paris weekend' })).toBeNull()
    const card = invitationCard()
    const acceptButton = card.getByRole('button', {
        name: 'Accept',
    }) as HTMLButtonElement
    const rejectButton = card.getByRole('button', {
        name: 'Reject',
    }) as HTMLButtonElement
    fireEvent.click(acceptButton)
    expect(acceptButton.disabled).toBe(true)
    expect(rejectButton.disabled).toBe(true)
    expect(
        (
            invitationCard('Winter holiday').getByRole('button', {
                name: 'Accept',
            }) as HTMLButtonElement
        ).disabled,
    ).toBe(false)
    expect(
        (
            invitationCard('Winter holiday').getByRole('button', {
                name: 'Reject',
            }) as HTMLButtonElement
        ).disabled,
    ).toBe(false)
    fireEvent.click(acceptButton)
    expect(
        fakeFetch.mock.calls.filter(([url]) => url.endsWith('/accept')),
    ).toHaveLength(1)

    await act(async () => {
        resolveDecision(new Response(null, { status: 204 }))
    })

    const tripLink = await screen.findByRole('link', { name: 'Paris weekend' })
    await screen.findByRole('heading', { name: 'Winter holiday' })
    expect(tripLink.getAttribute('href')).toBe('/trips/trip-a')
    expect(
        pendingSection().queryByRole('heading', { name: 'Paris weekend' }),
    ).toBeNull()
    expect(fakeFetch).toHaveBeenCalledWith(
        '/api/invitations/invitation-a/accept',
        { method: 'POST', credentials: 'same-origin' },
    )
    expect(
        fakeFetch.mock.calls.filter(([url]) => url === listPath),
    ).toHaveLength(2)
    expect(
        fakeFetch.mock.calls.filter(([url]) => url === '/api/trips'),
    ).toHaveLength(2)
})

// Rejecting removes only the chosen invitation and does not create a Trip.
it('rejects an invitation without refreshing My Trips', async () => {
    const fakeFetch = mockInvitationRequests()
    renderHome()
    await screen.findByRole('heading', { name: 'Paris weekend' })
    await screen.findByRole('heading', { name: 'No trips yet' })
    fireEvent.click(invitationCard().getByRole('button', { name: 'Reject' }))
    await screen.findByRole('heading', { name: 'Winter holiday' })
    await waitFor(() => {
        expect(
            pendingSection().queryByRole('heading', { name: 'Paris weekend' }),
        ).toBeNull()
    })
    expect(screen.getByRole('heading', { name: 'No trips yet' })).not.toBeNull()
    expect(screen.queryByRole('link', { name: 'Paris weekend' })).toBeNull()
    expect(fakeFetch).toHaveBeenCalledWith(
        '/api/invitations/invitation-a/reject',
        { method: 'POST', credentials: 'same-origin' },
    )
    expect(
        fakeFetch.mock.calls.filter(([url]) => url === '/api/trips'),
    ).toHaveLength(1)
    expect(
        fakeFetch.mock.calls.filter(([url]) => url === listPath),
    ).toHaveLength(1)
})

// Preserve failed decisions and keep feedback local to the affected card.
it.each(['accept', 'reject'] as const)(
    'preserves the invitation when %s fails',
    async (action) => {
        const fakeFetch = mockInvitationRequests({
            decisionResponse: async () => errorResponse('INTERNAL_ERROR', 500),
        })
        renderHome()
        await screen.findByRole('heading', { name: 'Paris weekend' })
        await screen.findByRole('heading', { name: 'No trips yet' })
        const card = invitationCard()
        fireEvent.click(
            card.getByRole('button', {
                name: action === 'accept' ? 'Accept' : 'Reject',
            }),
        )
        expect((await card.findByRole('alert')).textContent).toBe(
            'Unable to process this invitation. Please try again.',
        )
        expect(
            (card.getByRole('button', { name: 'Accept' }) as HTMLButtonElement)
                .disabled,
        ).toBe(false)
        expect(
            (card.getByRole('button', { name: 'Reject' }) as HTMLButtonElement)
                .disabled,
        ).toBe(false)
        expect(invitationCard('Winter holiday').queryByRole('alert')).toBeNull()
        expect(screen.queryByRole('link', { name: 'Paris weekend' })).toBeNull()
        expect(
            fakeFetch.mock.calls.filter(([url]) => url === '/api/trips'),
        ).toHaveLength(1)
        expect(
            fakeFetch.mock.calls.filter(([url]) => url === listPath),
        ).toHaveLength(1)
    },
)

// Explain stale invitations and reload authoritative data without retrying POST.
it.each([
    { code: 'INVITATION_NOT_FOUND', status: 404 },
    { code: 'INVITATION_NOT_PENDING', status: 409 },
])('refreshes the list after $code', async ({ code, status }) => {
    let serverInvitations = [...invitations]
    const fakeFetch = mockInvitationRequests({
        getInvitations: () => serverInvitations,
        decisionResponse: async () => {
            serverInvitations = [invitations[1]]
            return errorResponse(code, status)
        },
    })
    renderHome()
    await screen.findByRole('heading', { name: 'Paris weekend' })
    await screen.findByRole('heading', { name: 'No trips yet' })
    fireEvent.click(invitationCard().getByRole('button', { name: 'Accept' }))
    const card = invitationCard()
    expect((await card.findByRole('alert')).textContent).toBe(
        'This invitation is no longer available. Refresh the list.',
    )
    fireEvent.click(card.getByRole('button', { name: 'Refresh invitations' }))
    await screen.findByRole('heading', { name: 'Winter holiday' })
    expect(
        pendingSection().queryByRole('heading', { name: 'Paris weekend' }),
    ).toBeNull()
    expect(
        fakeFetch.mock.calls.filter(([url]) => url === listPath),
    ).toHaveLength(2)
    expect(
        fakeFetch.mock.calls.filter(([url]) => url.endsWith('/accept')),
    ).toHaveLength(1)
    expect(
        fakeFetch.mock.calls.filter(([url]) => url === '/api/trips'),
    ).toHaveLength(1)
})
