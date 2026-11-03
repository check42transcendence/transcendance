// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest'
import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    within,
} from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { MembershipRole, TripMember } from '@tripcollab/shared'
import { TripMembersSection } from './TripMembersSection'
import { HomePage } from '../../pages/HomePage'
import { CurrentPath } from '../../test-utils/CurrentPath'

// Current members returned by the simulated backend.
const members: TripMember[] = [
    {
        user: { id: 'owner-id', username: 'trip-owner' },
        role: 'OWNER',
        joinedAt: '2026-11-02T10:00:00.000Z',
    },
    {
        user: { id: 'member-id', username: 'trip-member' },
        role: 'MEMBER',
        joinedAt: '2026-11-02T11:00:00.000Z',
    },
]

const tripPath = '/api/trips/test-trip-id'
const workspacePath = '/trips/test-trip-id'

// Remember dialog methods so the test environment can be restored.
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

// JSDOM needs dialog opening and closing behavior for page interaction tests.
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

// Restore native descriptors instead of leaving test methods installed.
afterAll(() => {
    for (const [name, descriptor] of Object.entries(originalDialogMethods)) {
        if (descriptor) {
            Object.defineProperty(HTMLDialogElement.prototype, name, descriptor)
        } else {
            Reflect.deleteProperty(HTMLDialogElement.prototype, name)
        }
    }
})

// Clean up the page and mocked requests after each test.
afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
})

// Build a fresh JSON response for each request.
function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

// Match member, leave, and Home requests without relying on request order.
function mockMemberRequests(
    membersStatus = 200,
    leaveResponse?: Promise<Response>,
    invitationResponse?: Response,
) {
    const fakeFetch = vi.fn(async (url: string, options?: RequestInit) => {
        if (url === `${tripPath}/members` && !options?.method) {
            if (membersStatus === 200) return jsonResponse({ members })
            return jsonResponse(
                {
                    error: {
                        code: 'INTERNAL_ERROR',
                        message: 'Internal server error',
                        details: {},
                    },
                },
                membersStatus,
            )
        }
        if (url === `${tripPath}/leave` && options?.method === 'POST') {
            return leaveResponse ?? new Response(null, { status: 204 })
        }
        if (url === '/api/trips' && !options?.method) {
            return jsonResponse({ trips: [] })
        }
        if (
            url === `${tripPath}/invitations` &&
            options?.method === 'POST'
        ) {
            return invitationResponse?.clone() ?? new Response(null, { status: 201 })
        }
        throw new Error(
            `Unexpected test request: ${options?.method ?? 'GET'} ${url}`,
        )
    })
    vi.stubGlobal('fetch', fakeFetch)
    return fakeFetch
}

// Render the members area in a route with the real Home destination.
function renderMembers(role: MembershipRole = 'MEMBER') {
    return render(
        <MemoryRouter initialEntries={[workspacePath]}>
            <Routes>
                <Route
                    path="/trips/:tripId"
                    element={
                        <TripMembersSection
                            tripId="test-trip-id"
                            currentUserRole={role}
                        />
                    }
                />
                <Route
                    path="/home"
                    element={
                        <HomePage
                            username="trip-member"
                            onLogout={vi.fn().mockResolvedValue(undefined)}
                            logoutError=""
                        />
                    }
                />
            </Routes>
            <CurrentPath />
        </MemoryRouter>,
    )
}

// Open confirmation through the member's leave action.
async function openLeaveDialog() {
    await screen.findByText('trip-owner')
    fireEvent.click(screen.getByRole('button', { name: 'Leave trip' }))
    return screen.getByRole('dialog', { name: 'Leave this trip?' })
}

// Show loaded usernames and roles without allowing the owner to leave.
it('displays members and hides leave from the owner', async () => {
    const fakeFetch = mockMemberRequests()
    renderMembers('OWNER')

    await screen.findByText('trip-owner')
    expect(screen.getByText('trip-member')).not.toBeNull()
    expect(screen.getByText('Owner')).not.toBeNull()
    expect(screen.getByText('Member')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Leave trip' })).toBeNull()
    expect(
        screen.getByRole('button', { name: 'Invite member' }),
    ).not.toBeNull()
    expect(fakeFetch).toHaveBeenCalledWith(`${tripPath}/members`, {
        credentials: 'same-origin',
    })
})

// Distinguish a failed member request from an empty member list.
it('shows an error when members cannot be loaded', async () => {
    mockMemberRequests(500)
    renderMembers('OWNER')

    expect((await screen.findByRole('alert')).textContent).toBe(
        'Unable to load members. Please try again.',
    )
    expect(screen.queryByText('No members to display.')).toBeNull()
    expect(screen.queryByText('trip-owner')).toBeNull()
})

// Cancel confirmation without sending a leave request or changing the route.
it('keeps the workspace when a member cancels leaving', async () => {
    const fakeFetch = mockMemberRequests()
    renderMembers()

    expect(
        screen.queryByRole('button', { name: 'Invite member' }),
    ).toBeNull()

    const dialog = await openLeaveDialog()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(
        screen.queryByRole('dialog', { name: 'Leave this trip?' }),
    ).toBeNull()
    expect(screen.getByText('trip-owner')).not.toBeNull()
    expect(screen.getByLabelText('Current path').textContent).toBe(
        workspacePath,
    )
    expect(fakeFetch).not.toHaveBeenCalledWith(
        `${tripPath}/leave`,
        expect.objectContaining({ method: 'POST' }),
    )
})

// Prevent repeated actions while pending, then reload Home only after success.
it('waits for successful leave before returning to the updated Home', async () => {
    let resolveLeave!: (response: Response) => void
    const pendingLeave = new Promise<Response>((resolve) => {
        resolveLeave = resolve
    })
    const fakeFetch = mockMemberRequests(200, pendingLeave)
    renderMembers()
    const dialog = await openLeaveDialog()
    const confirmButton = within(dialog).getByRole('button', {
        name: 'Leave trip',
    })

    fireEvent.click(confirmButton)

    const pendingButton = await within(dialog).findByRole('button', {
        name: 'Leave trip',
    })
    expect((pendingButton as HTMLButtonElement).disabled).toBe(true)
    expect(
        (
            within(dialog).getByRole('button', {
                name: 'Cancel',
            }) as HTMLButtonElement
        ).disabled,
    ).toBe(true)
    fireEvent.click(pendingButton)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(screen.getByRole('dialog', { name: 'Leave this trip?' })).toBe(
        dialog,
    )
    expect(screen.getByLabelText('Current path').textContent).toBe(
        workspacePath,
    )
    expect(fakeFetch).toHaveBeenCalledWith(`${tripPath}/leave`, {
        method: 'POST',
        credentials: 'same-origin',
    })
    expect(
        fakeFetch.mock.calls.filter(([url]) => url === `${tripPath}/leave`),
    ).toHaveLength(1)
    expect(fakeFetch).not.toHaveBeenCalledWith('/api/trips', expect.anything())

    await act(async () => {
        resolveLeave(new Response(null, { status: 204 }))
    })

    await screen.findByRole('heading', { name: 'No trips yet' })
    expect(screen.getByLabelText('Current path').textContent).toBe('/home')
    expect(fakeFetch).toHaveBeenCalledWith('/api/trips', {
        credentials: 'same-origin',
    })
    expect(screen.queryByRole('heading', { name: 'Members' })).toBeNull()
})

// Preserve the workspace and restore controls when the leave request fails.
it('keeps confirmation open and allows retry after leave fails', async () => {
    const failedLeave = Promise.resolve(
        jsonResponse(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Internal server error',
                    details: {},
                },
            },
            500,
        ),
    )
    mockMemberRequests(200, failedLeave)
    renderMembers()
    const dialog = await openLeaveDialog()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Leave trip' }))

    expect((await within(dialog).findByRole('alert')).textContent).toBe(
        'Unable to leave the trip. Please try again.',
    )
    expect(screen.getByRole('dialog', { name: 'Leave this trip?' })).toBe(
        dialog,
    )
    expect(screen.getByText('trip-owner')).not.toBeNull()
    expect(screen.getByLabelText('Current path').textContent).toBe(
        workspacePath,
    )
    expect(
        (
            within(dialog).getByRole('button', {
                name: 'Leave trip',
            }) as HTMLButtonElement
        ).disabled,
    ).toBe(false)
    expect(
        (
            within(dialog).getByRole('button', {
                name: 'Cancel',
            }) as HTMLButtonElement
        ).disabled,
    ).toBe(false)
})

// Invite by either identifier without adding the pending invitee to members.
it.each([
    {
        method: 'username',
        label: 'Username',
        identifier: 'invited-user',
    },
    {
        method: 'email',
        label: 'Email',
        identifier: 'invited-user@example.com',
    },
])('invites a user by $method and shows success', async ({
    method,
    label,
    identifier,
}) => {
    const fakeFetch = mockMemberRequests()
    renderMembers('OWNER')

    await screen.findByText('trip-owner')

    fireEvent.click(
        screen.getByRole('button', { name: 'Invite member' }),
    )

    const dialog = screen.getByRole('dialog', {
        name: 'Invite a member',
    })

    fireEvent.change(
        within(dialog).getByLabelText('Find user by'),
        { target: { value: method } },
    )

    const identifierInput = within(dialog).getByLabelText(label)

    fireEvent.change(identifierInput, {
        target: { value: `  ${identifier}  ` },
    })

    fireEvent.click(
        within(dialog).getByRole('button', { name: 'Invite member' }),
    )

    await within(dialog).findByText('Invitation sent.')

    expect(fakeFetch).toHaveBeenCalledWith(
        `${tripPath}/invitations`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [method]: identifier }),
            credentials: 'same-origin',
        },
    )

    expect((identifierInput as HTMLInputElement).value).toBe('')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
})

// Explain invitation conflicts while preserving input for correction or retry.
it.each([
    {
        code: 'INVITEE_NOT_FOUND',
        status: 404,
        message: 'No user found with that username or email.',
    },
    {
        code: 'INVITATION_ALREADY_PENDING',
        status: 409,
        message: 'This user already has a pending invitation.',
    },
    {
        code: 'MEMBERSHIP_ALREADY_EXISTS',
        status: 409,
        message: 'This user is already a trip member.',
    },
])('shows invitation feedback for $code', async ({
    code,
    status,
    message,
}) => {
    const invitationResponse = jsonResponse(
        {
            error: {
                code,
                message: 'Invitation failed',
                details: {},
            },
        },
        status,
    )

    mockMemberRequests(200, undefined, invitationResponse)
    renderMembers('OWNER')

    await screen.findByText('trip-owner')

    fireEvent.click(
        screen.getByRole('button', { name: 'Invite member' }),
    )

    const dialog = screen.getByRole('dialog', {
        name: 'Invite a member',
    })
    const identifierInput = within(dialog).getByLabelText('Username')

    fireEvent.change(identifierInput, {
        target: { value: 'invited-user' },
    })

    const submitButton = within(dialog).getByRole('button', {
        name: 'Invite member',
    })

    fireEvent.click(submitButton)

    expect((await within(dialog).findByRole('alert')).textContent).toBe(
        message,
    )
    expect((identifierInput as HTMLInputElement).value).toBe(
        'invited-user',
    )
    expect((submitButton as HTMLButtonElement).disabled).toBe(false)
    expect(
        within(dialog).queryByText('Invitation sent.'),
    ).toBeNull()
})
