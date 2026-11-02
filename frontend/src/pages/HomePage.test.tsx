// @vitest-environment jsdom

import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { HomePage } from './HomePage'
import { CurrentPath } from '../test-utils/CurrentPath'

// Remove rendered components and mocked globals after each test.
afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
})

// Display loaded trips and open the selected trip's workspace path.
it('displays trips and navigates to the selected workspace', async () => {
    const trip = {
        id: 'test-trip-id',
        title: 'Paris weekend',
        destination: 'Paris',
        startDate: '2026-11-03',
        endDate: '2026-11-04',
        description: null,
        currentUserRole: 'OWNER',
    }

    const fakeFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ trips: [trip] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }),
    )

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
    const fakeFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ trips: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }),
    )

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
    const fakeFetch = vi.fn().mockResolvedValue(
        new Response(null, {
            status: 500,
        }),
    )

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
