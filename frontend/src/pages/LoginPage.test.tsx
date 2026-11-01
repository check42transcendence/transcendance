// @vitest-environment jsdom

import { expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import App from '../App'
import { setupAppTests } from '../test-utils/app-test-setup'
import { CurrentPath } from '../test-utils/CurrentPath'

setupAppTests()

// Exercise login through App, including API handling and navigation.

// Signs in through the login page and opens home.
it('logs in and navigates to home', async () => {
    render(
        <MemoryRouter initialEntries={['/login']}>
            <App />
            <CurrentPath />
        </MemoryRouter>,
    )

    await screen.findByRole('heading', {
        name: 'Welcome back',
    })

    const fakeFetch = vi
        .fn()
        .mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    user: {
                        id: 'test-user-id',
                        email: 'test-user@example.com',
                        username: 'test-user',
                    },
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                },
            ),
        )
        .mockResolvedValueOnce(
            new Response(JSON.stringify({ trips: [] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }),
        )

    vi.stubGlobal('fetch', fakeFetch)

    fireEvent.change(screen.getByLabelText('Email'), {
        target: { value: 'test-user@example.com' },
    })

    fireEvent.change(screen.getByLabelText('Password'), {
        target: { value: 'example-password' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await screen.findByRole('heading', { name: 'Signed in' })

    expect(screen.getByText('test-user')).not.toBeNull()

    expect(screen.getByLabelText('Current path').textContent).toBe('/home')

    await screen.findByRole('heading', { name: 'No trips yet' })
    expect(fakeFetch).toHaveBeenCalledTimes(2)

    expect(fakeFetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
            email: 'test-user@example.com',
            password: 'example-password',
        }),
    })
})

// Keeps the user on login when credentials are invalid.
it('shows an error when login credentials are invalid', async () => {
    render(
        <MemoryRouter initialEntries={['/login']}>
            <App />
            <CurrentPath />
        </MemoryRouter>,
    )

    await screen.findByRole('heading', {
        name: 'Welcome back',
    })

    const fakeFetch = vi.fn().mockResolvedValue(
        new Response(
            JSON.stringify({
                error: {
                    code: 'INVALID_CREDENTIALS',
                    message: 'Invalid email or password',
                    details: {},
                },
            }),
            {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            },
        ),
    )

    vi.stubGlobal('fetch', fakeFetch)

    fireEvent.change(screen.getByLabelText('Email'), {
        target: { value: 'test-user@example.com' },
    })

    fireEvent.change(screen.getByLabelText('Password'), {
        target: { value: 'wrong-password' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    const alert = await screen.findByRole('alert')

    expect(alert.textContent).toBe('Invalid email or password')

    expect(screen.getByLabelText('Current path').textContent).toBe('/login')

    expect(screen.queryByRole('heading', { name: 'Signed in' })).toBeNull()

    expect(
        screen
            .getByRole('button', { name: 'Sign in' })
            .hasAttribute('disabled'),
    ).toBe(false)
})

// Shows a validation error without sending a login request.
it('blocks login when the password is too short', async () => {
    render(
        <MemoryRouter initialEntries={['/login']}>
            <App />
        </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'Welcome back' })

    fireEvent.change(screen.getByLabelText('Email'), {
        target: { value: 'alice@example.com' },
    })

    fireEvent.change(screen.getByLabelText('Password'), {
        target: { value: '1234567' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByRole('alert').textContent).toBe(
        'Password must contain at least 8 characters.',
    )
    expect(fetch).toHaveBeenCalledTimes(1)
})
