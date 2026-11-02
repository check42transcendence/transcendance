// @vitest-environment jsdom

import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { CreateTripPage } from './CreateTripPage'
import { CurrentPath } from '../test-utils/CurrentPath'

// Remove rendered components and mocked globals after each test.
afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
})

// Submit valid trip data and open the newly created workspace path.
it('creates a trip and navigates to its workspace', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
        new Response(
            JSON.stringify({
                trip: {
                    id: 'new-trip-id',
                },
            }),
            {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
            },
        ),
    )

    vi.stubGlobal('fetch', fakeFetch)

    render(
        <MemoryRouter initialEntries={['/trips/new']}>
            <CreateTripPage />
            <CurrentPath />
        </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Trip title'), {
        target: { value: 'Paris weekend' },
    })

    fireEvent.change(screen.getByLabelText('Trip destination'), {
        target: { value: 'Paris' },
    })

    fireEvent.change(screen.getByLabelText('Start date'), {
        target: { value: '2026-11-03' },
    })

    fireEvent.change(screen.getByLabelText('End date'), {
        target: { value: '2026-11-04' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create trip' }))

    await screen.findByText('/trips/new-trip-id', {
        selector: 'output',
    })

    expect(fakeFetch).toHaveBeenCalledTimes(1)

    expect(fakeFetch).toHaveBeenCalledWith('/api/trips', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: 'Paris weekend',
            destination: 'Paris',
            startDate: '2026-11-03',
            endDate: '2026-11-04',
            description: null,
        }),
    })
})

// Block submission when required fields are empty.
it('blocks creation when required fields are empty', () => {
    const fakeFetch = vi.fn()

    vi.stubGlobal('fetch', fakeFetch)

    render(
        <MemoryRouter initialEntries={['/trips/new']}>
            <CreateTripPage />
        </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create trip' }))

    expect(screen.getByRole('alert').textContent).toBe(
        'Please complete all required fields.',
    )

    expect(fakeFetch).not.toHaveBeenCalled()
})

// Preserve form values and allow another submission after a request failure.
it('preserves input and restores submission when creation fails', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
        new Response(null, {
            status: 500,
        }),
    )

    vi.stubGlobal('fetch', fakeFetch)

    render(
        <MemoryRouter initialEntries={['/trips/new']}>
            <CreateTripPage />
            <CurrentPath />
        </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Trip title'), {
        target: { value: 'Paris weekend' },
    })

    fireEvent.change(screen.getByLabelText('Trip destination'), {
        target: { value: 'Paris' },
    })

    fireEvent.change(screen.getByLabelText('Start date'), {
        target: { value: '2026-11-03' },
    })

    fireEvent.change(screen.getByLabelText('End date'), {
        target: { value: '2026-11-04' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create trip' }))

    const alert = await screen.findByRole('alert')

    expect(alert.textContent).toBe(
        'Unable to create the trip. Please try again.',
    )

    expect(screen.getByDisplayValue('Paris weekend')).not.toBeNull()
    expect(screen.getByDisplayValue('Paris')).not.toBeNull()
    expect(screen.getByDisplayValue('2026-11-03')).not.toBeNull()
    expect(screen.getByDisplayValue('2026-11-04')).not.toBeNull()

    expect(
        screen
            .getByRole('button', { name: 'Create trip' })
            .hasAttribute('disabled'),
    ).toBe(false)

    expect(screen.getByLabelText('Current path').textContent).toBe('/trips/new')
})

// Reject reversed dates before sending a creation request.
it('blocks creation when the end date precedes the start date', () => {
    const fakeFetch = vi.fn()

    vi.stubGlobal('fetch', fakeFetch)

    render(
        <MemoryRouter initialEntries={['/trips/new']}>
            <CreateTripPage />
        </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Trip title'), {
        target: { value: 'Paris weekend' },
    })

    fireEvent.change(screen.getByLabelText('Trip destination'), {
        target: { value: 'Paris' },
    })

    fireEvent.change(screen.getByLabelText('Start date'), {
        target: { value: '2026-11-04' },
    })

    fireEvent.change(screen.getByLabelText('End date'), {
        target: { value: '2026-11-03' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create trip' }))

    expect(screen.getByRole('alert').textContent).toBe(
        'End date must not be earlier than start date.',
    )

    expect(fakeFetch).not.toHaveBeenCalled()
})

// Allow a trip lasting exactly 365 days, including both endpoints.
it('allows creation of a trip lasting exactly 365 days', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
        new Response(
            JSON.stringify({
                trip: {
                    id: 'year-trip-id',
                },
            }),
            {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
            },
        ),
    )

    vi.stubGlobal('fetch', fakeFetch)

    render(
        <MemoryRouter initialEntries={['/trips/new']}>
            <CreateTripPage />
            <CurrentPath />
        </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Trip title'), {
        target: { value: 'Year trip' },
    })

    fireEvent.change(screen.getByLabelText('Trip destination'), {
        target: { value: 'Paris' },
    })

    fireEvent.change(screen.getByLabelText('Start date'), {
        target: { value: '2027-01-01' },
    })

    fireEvent.change(screen.getByLabelText('End date'), {
        target: { value: '2027-12-31' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create trip' }))

    await screen.findByText('/trips/year-trip-id', {
        selector: 'output',
    })

    expect(fakeFetch).toHaveBeenCalledTimes(1)
})

// Reject trips exceeding 365 days before sending a creation request.
it('blocks creation of a trip lasting 366 days', () => {
    const fakeFetch = vi.fn()

    vi.stubGlobal('fetch', fakeFetch)

    render(
        <MemoryRouter initialEntries={['/trips/new']}>
            <CreateTripPage />
        </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Trip title'), {
        target: { value: 'Year trip' },
    })

    fireEvent.change(screen.getByLabelText('Trip destination'), {
        target: { value: 'Paris' },
    })

    fireEvent.change(screen.getByLabelText('Start date'), {
        target: { value: '2027-01-01' },
    })

    fireEvent.change(screen.getByLabelText('End date'), {
        target: { value: '2028-01-01' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create trip' }))

    expect(screen.getByRole('alert').textContent).toBe(
        'A trip must not exceed 365 days.',
    )

    expect(fakeFetch).not.toHaveBeenCalled()
})
