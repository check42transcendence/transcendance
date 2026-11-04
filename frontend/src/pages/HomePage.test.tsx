// @vitest-environment jsdom

import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { TripSummary } from '@tripcollab/shared'
import { HomePage } from './HomePage'
import { CurrentPath } from '../test-utils/CurrentPath'

// Remove rendered components and mocked globals after each test.
afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
})

// Keep invitation responses separate from the Trip scenario under test.
function mockHomeRequests(trips: TripSummary[] = [], tripsStatus = 200) {
    return vi.fn(async (url: string) => {
        if (url === '/api/invitations?status=PENDING') {
            return new Response(JSON.stringify({ invitations: [] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        }
        if (url === '/api/trips') {
            return tripsStatus === 200
                ? new Response(JSON.stringify({ trips }), {
                      status: 200,
                      headers: { 'Content-Type': 'application/json' },
                  })
                : new Response(null, { status: tripsStatus })
        }
        throw new Error(`Unexpected test request: ${url}`)
    })
}

// Display loaded trips and open the selected trip's workspace path.
it('displays trips and navigates to the selected workspace', async () => {
    const trip = {
        id: 'test-trip-id',
        title: 'Paris weekend',
        destination: 'Paris',
        startDate: '2026-11-03',
        endDate: '2026-11-04',
        description: null,
        currentUserRole: 'OWNER' as const,
    }

    const fakeFetch = mockHomeRequests([trip])

    vi.stubGlobal('fetch', fakeFetch)

    render(
        <MemoryRouter initialEntries={['/home']}>
            <HomePage
                username="test-user"
                onLogout={vi.fn().mockResolvedValue(undefined)}
                logoutError=""
            />
            <CurrentPath />
        </MemoryRouter>,
    )

    const tripLink = await screen.findByRole('link', {
        name: 'Paris weekend',
    })

    expect(screen.getByText('Paris')).not.toBeNull()

    fireEvent.click(tripLink)

    expect(screen.getByLabelText('Current path').textContent).toBe(
        '/trips/test-trip-id',
    )
})

// Show an empty state when the user has no trips.
it('shows an empty state when there are no trips', async () => {
    const fakeFetch = mockHomeRequests()

    vi.stubGlobal('fetch', fakeFetch)

    render(
        <MemoryRouter initialEntries={['/home']}>
            <HomePage
                username="test-user"
                onLogout={vi.fn().mockResolvedValue(undefined)}
                logoutError=""
            />
        </MemoryRouter>,
    )

    await screen.findByRole('heading', {
        name: 'No trips yet',
    })

    expect(
        screen.getByRole('link', { name: 'Create trip' }).getAttribute('href'),
    ).toBe('/trips/new')
})

// Show a request error instead of an empty state when loading fails.
it('shows an error when loading trips fails', async () => {
    const fakeFetch = mockHomeRequests([], 500)

    vi.stubGlobal('fetch', fakeFetch)

    render(
        <MemoryRouter initialEntries={['/home']}>
            <HomePage
                username="test-user"
                onLogout={vi.fn().mockResolvedValue(undefined)}
                logoutError=""
            />
        </MemoryRouter>,
    )

    const alert = await screen.findByRole('alert')

    expect(alert.textContent).toBe(
        'Unable to load your trips. Please try again.',
    )

    expect(screen.queryByRole('heading', { name: 'No trips yet' })).toBeNull()
})
