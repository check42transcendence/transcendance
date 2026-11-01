// @vitest-environment jsdom

import { expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import App from '../App'
import { setupAppTests } from '../test-utils/app-test-setup'

setupAppTests()

// Exercise registration through App, including API errors and success feedback.

// Submits registration details and shows success.
it('registers a user through the registration page', async () => {
    render(
        <MemoryRouter initialEntries={['/register']}>
            <App />
        </MemoryRouter>,
    )

    await screen.findByRole('heading', {
        name: 'Create your account',
    })

    // Replaces fetch after the initial session check.
    const fakeFetch = vi.fn().mockResolvedValue(
        new Response(
            JSON.stringify({
                user: {
                    id: 'test-user-id',
                    email: 'test-user@example.com',
                    username: 'test-user',
                },
            }),
            {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
            },
        ),
    )

    vi.stubGlobal('fetch', fakeFetch)

    fireEvent.change(screen.getByLabelText('Email'), {
        target: { value: 'test-user@example.com' },
    })

    fireEvent.change(screen.getByLabelText('Username'), {
        target: { value: 'test-user' },
    })

    fireEvent.change(screen.getByLabelText('Password'), {
        target: { value: 'example-password' },
    })

    fireEvent.change(screen.getByLabelText('Confirm password'), {
        target: { value: 'example-password' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await screen.findByText('Account created. Please sign in.')

    expect(fakeFetch).toHaveBeenCalledTimes(1)

    expect(fakeFetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
            email: 'test-user@example.com',
            username: 'test-user',
            password: 'example-password',
        }),
    })
})

// Displays the backend error when registration fails.
it('shows an error when the registration email already exists', async () => {
    render(
        <MemoryRouter initialEntries={['/register']}>
            <App />
        </MemoryRouter>,
    )

    await screen.findByRole('heading', {
        name: 'Create your account',
    })

    const fakeFetch = vi.fn().mockResolvedValue(
        new Response(
            JSON.stringify({
                error: {
                    code: 'EMAIL_ALREADY_EXISTS',
                    message: 'Email already exists',
                    details: {},
                },
            }),
            {
                status: 409,
                headers: { 'Content-Type': 'application/json' },
            },
        ),
    )

    vi.stubGlobal('fetch', fakeFetch)

    fireEvent.change(screen.getByLabelText('Email'), {
        target: { value: 'test-user@example.com' },
    })

    fireEvent.change(screen.getByLabelText('Username'), {
        target: { value: 'test-user' },
    })

    fireEvent.change(screen.getByLabelText('Password'), {
        target: { value: 'example-password' },
    })

    fireEvent.change(screen.getByLabelText('Confirm password'), {
        target: { value: 'example-password' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    const alert = await screen.findByRole('alert')

    expect(alert.textContent).toBe('Email already exists')

    expect(screen.queryByText('Account created. Please sign in.')).toBeNull()

    expect(
        screen
            .getByRole('button', { name: 'Create account' })
            .hasAttribute('disabled'),
    ).toBe(false)
})

// Displays the backend error when the registration username already exists.
it('shows an error when the registration username already exists', async () => {
    render(
        <MemoryRouter initialEntries={['/register']}>
            <App />
        </MemoryRouter>,
    )

    await screen.findByRole('heading', {
        name: 'Create your account',
    })

    const fakeFetch = vi.fn().mockResolvedValue(
        new Response(
            JSON.stringify({
                error: {
                    code: 'USERNAME_ALREADY_EXISTS',
                    message: 'Username already exists',
                    details: {},
                },
            }),
            {
                status: 409,
                headers: { 'Content-Type': 'application/json' },
            },
        ),
    )

    vi.stubGlobal('fetch', fakeFetch)

    fireEvent.change(screen.getByLabelText('Email'), {
        target: { value: 'another-user@example.com' },
    })

    fireEvent.change(screen.getByLabelText('Username'), {
        target: { value: 'existing-user' },
    })

    fireEvent.change(screen.getByLabelText('Password'), {
        target: { value: 'example-password' },
    })

    fireEvent.change(screen.getByLabelText('Confirm password'), {
        target: { value: 'example-password' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    const alert = await screen.findByRole('alert')

    expect(alert.textContent).toBe('Username already exists')

    expect(screen.queryByText('Account created. Please sign in.')).toBeNull()

    expect(
        screen
            .getByRole('button', { name: 'Create account' })
            .hasAttribute('disabled'),
    ).toBe(false)
})

// Shows a validation error without sending a registration request.
it('blocks registration when the password exceeds 72 UTF-8 bytes', async () => {
    render(
        <MemoryRouter initialEntries={['/register']}>
            <App />
        </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'Create your account' })

    const password = '中'.repeat(24) + 'a'

    fireEvent.change(screen.getByLabelText('Email'), {
        target: { value: 'alice@example.com' },
    })

    fireEvent.change(screen.getByLabelText('Username'), {
        target: { value: 'alice' },
    })

    fireEvent.change(screen.getByLabelText('Password', { exact: true }), {
        target: { value: password },
    })

    fireEvent.change(screen.getByLabelText('Confirm password'), {
        target: { value: password },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByRole('alert').textContent).toBe(
        'Password must not exceed 72 UTF-8 bytes.',
    )
    expect(fetch).toHaveBeenCalledTimes(1)
})
