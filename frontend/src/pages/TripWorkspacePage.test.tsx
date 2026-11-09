// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest'
import {
    cleanup,
    fireEvent,
    render,
    screen,
    within,
} from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import type {
    MembershipRole,
    TripDetail,
    ItineraryDay,
} from '@tripcollab/shared'
import { TripWorkspacePage } from './TripWorkspacePage'
import { HomePage } from './HomePage'
import { CurrentPath } from '../test-utils/CurrentPath'

// Public trip details reused by workspace tests.
const trip: TripDetail = {
    id: 'test-trip-id',
    title: 'Paris weekend',
    destination: 'Paris',
    startDate: '2026-11-03',
    endDate: '2026-11-03',
    description: null,
    currentUserRole: 'MEMBER',
    createdBy: {
        id: 'owner-id',
        username: 'trip-owner',
    },
    createdAt: '2026-11-01T12:00:00.000Z',
}

// Generated days returned by the backend.
const days: ItineraryDay[] = [
    {
        id: 'test-day-id',
        tripId: trip.id,
        dayNumber: 1,
        date: '2026-11-03',
    },
]

const tripPath = `/api/trips/${trip.id}`
const workspacePath = `/trips/${trip.id}`

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

// Remove rendered components and mocked globals after each test.
afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
})

// Create a fresh response body for each simulated request.
function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

// Match requests by URL and method so unrelated calls do not consume responses.
function mockWorkspaceRequests(
    role: MembershipRole = 'OWNER',
    deleteStatus = 204,
) {
    const fakeFetch = vi.fn(async (url: string, options?: RequestInit) => {
        if (url === tripPath && options?.method === 'DELETE') {
            if (deleteStatus === 204) {
                return new Response(null, { status: 204 })
            }

            return jsonResponse(
                {
                    error: {
                        code: 'INTERNAL_ERROR',
                        message: 'Internal server error',
                        details: {},
                    },
                },
                deleteStatus,
            )
        }

        if (url === tripPath && !options?.method) {
            return jsonResponse({ trip: { ...trip, currentUserRole: role } })
        }

        if (url === `${tripPath}/days` && !options?.method) {
            return jsonResponse({ days })
        }

        if (url === `${tripPath}/members` && !options?.method) {
            return jsonResponse({ members: [] })
        }

        if (url === `${tripPath}/activities` && !options?.method) {
            return jsonResponse({ activities: [] })
        }

        if (url === `${tripPath}/proposals` && !options?.method) {
            return jsonResponse({ proposals: [] })
        }

        if (url === '/api/invitations?status=PENDING' && !options?.method) {
            return jsonResponse({ invitations: [] })
        }
        if (url === '/api/trips' && !options?.method) {
            return jsonResponse({ trips: [] })
        }

        throw new Error(
            `Unexpected test request: ${options?.method ?? 'GET'} ${url}`,
        )
    })

    vi.stubGlobal('fetch', fakeFetch)
    return fakeFetch
}

// Enter through the real workspace route and keep Home available after deletion.
function renderWorkspace() {
    return render(
        <MemoryRouter initialEntries={[workspacePath]}>
            <Routes>
                <Route path="/trips/:tripId" element={<TripWorkspacePage />} />
                <Route
                    path="/home"
                    element={
                        <HomePage
                            username="test-user"
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

// Open confirmation through the same button the owner uses.
async function openDeleteDialog() {
    const button = await screen.findByRole('button', { name: 'Delete trip' })
    fireEvent.click(button)
    return screen.getByRole('dialog', { name: 'Delete this trip?' })
}

// Load from the URL again after remounting, without data passed from Home.
it('loads member details and days on direct entry and remount', async () => {
    const fakeFetch = mockWorkspaceRequests('MEMBER')
    const view = renderWorkspace()

    expect(
        within(screen.getByRole('main')).getByRole('status').textContent,
    ).toBe('Loading trip...')
    await screen.findByRole('heading', { name: trip.title })
    expect(screen.getByText('Trip destination: Paris')).not.toBeNull()
    expect(screen.getByText('Member')).not.toBeNull()
    expect(screen.getByText('Day 1')).not.toBeNull()
    expect(screen.getByText(days[0].date)).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete trip' })).toBeNull()
    // Verify the Proposal section is integrated into the Trip Workspace.
    expect(
        await screen.findByRole('heading', { name: 'Decisions' }),
    ).not.toBeNull()
    expect(await screen.findByText('No proposals yet')).not.toBeNull()

    view.unmount()
    renderWorkspace()

    await screen.findByRole('heading', { name: trip.title })
    expect(screen.getByText('Day 1')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete trip' })).toBeNull()
    expect(fakeFetch).toHaveBeenCalledWith(tripPath, {
        credentials: 'same-origin',
    })
    expect(fakeFetch).toHaveBeenCalledWith(`${tripPath}/days`, {
        credentials: 'same-origin',
    })
})

// Do not reveal whether a trip is missing or merely inaccessible.
it('shows an unavailable message for a missing or inaccessible trip', async () => {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
            jsonResponse(
                {
                    error: {
                        code: 'TRIP_NOT_FOUND',
                        message: 'Trip not found',
                        details: {},
                    },
                },
                404,
            ),
        ),
    )

    renderWorkspace()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe(
        'This trip does not exist or you do not have access.',
    )
    expect(screen.queryByRole('heading', { name: trip.title })).toBeNull()
    expect(
        screen.getByRole('link', { name: 'Back to home' }).getAttribute('href'),
    ).toBe('/home')
})

// Keep ordinary request failures distinct from missing-trip errors.
it('shows a loading error when the request fails', async () => {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    )
    renderWorkspace()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Unable to load the trip. Please try again.')
    expect(screen.queryByRole('heading', { name: trip.title })).toBeNull()
})

// Cancel confirmation without calling the delete endpoint.
it('keeps the trip when the owner cancels deletion', async () => {
    const fakeFetch = mockWorkspaceRequests()
    renderWorkspace()
    const dialog = await openDeleteDialog()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('heading', { name: trip.title })).not.toBeNull()
    expect(screen.getByLabelText('Current path').textContent).toBe(
        workspacePath,
    )
    expect(fakeFetch).not.toHaveBeenCalledWith(
        tripPath,
        expect.objectContaining({ method: 'DELETE' }),
    )
})

// A successful deletion returns to the real Home page and reloads its list.
it('returns home and reloads trips after confirmed deletion', async () => {
    const fakeFetch = mockWorkspaceRequests()
    renderWorkspace()
    const dialog = await openDeleteDialog()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete trip' }))

    await screen.findByRole('heading', { name: 'No trips yet' })
    expect(screen.getByLabelText('Current path').textContent).toBe('/home')
    expect(fakeFetch).toHaveBeenCalledWith(tripPath, {
        method: 'DELETE',
        credentials: 'same-origin',
    })
    expect(fakeFetch).toHaveBeenCalledWith('/api/trips', {
        credentials: 'same-origin',
    })
})

// Keep the workspace and dialog available for retry when deletion fails.
it('preserves the workspace and allows retry when deletion fails', async () => {
    mockWorkspaceRequests('OWNER', 500)
    renderWorkspace()
    const dialog = await openDeleteDialog()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete trip' }))

    const alert = await within(dialog).findByRole('alert')
    expect(alert.textContent).toBe(
        'Unable to delete the trip. Please try again.',
    )
    expect(screen.getByRole('dialog', { name: 'Delete this trip?' })).toBe(
        dialog,
    )
    expect(screen.getByRole('heading', { name: trip.title })).not.toBeNull()
    expect(screen.getByLabelText('Current path').textContent).toBe(
        workspacePath,
    )
    expect(
        within(dialog)
            .getByRole('button', { name: 'Delete trip' })
            .hasAttribute('disabled'),
    ).toBe(false)
    expect(
        within(dialog)
            .getByRole('button', { name: 'Cancel' })
            .hasAttribute('disabled'),
    ).toBe(false)
})
