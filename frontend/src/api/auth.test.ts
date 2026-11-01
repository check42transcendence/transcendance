import { afterEach, expect, it, vi } from 'vitest'
import { register, login, getMe, logout } from './auth'
import type { RegisterInput, LoginInput } from '@tripcollab/shared'

// Restores the real fetch after each test.
afterEach(() => {
    vi.unstubAllGlobals()
})

// Public user information returned by successful requests.
const userResponse = {
    user: {
        id: 'test-user-id',
        email: 'test@example.com',
        username: 'test-user',
    },
}

// Registration input shared by the tests.
const registerInput: RegisterInput = {
    email: 'test@example.com',
    username: 'test-user',
    password: 'example-password',
}

// Login input shared by the tests.
const loginInput: LoginInput = {
    email: 'test@example.com',
    password: 'example-password',
}

// Checks the registration request and returned user.
it('returns the user after successful registration', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(userResponse), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        }),
    )
    vi.stubGlobal('fetch', fakeFetch)
    const result = await register(registerInput)
    expect(result).toEqual(userResponse)
    expect(fakeFetch).toHaveBeenCalledTimes(1)
    expect(fakeFetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(registerInput),
        credentials: 'same-origin',
    })
})

// Preserves the backend error for a duplicate email.
it('rejects registration when the email already exists', async () => {
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
                headers: {
                    'Content-Type': 'application/json',
                },
            },
        ),
    )
    vi.stubGlobal('fetch', fakeFetch)
    await expect(
        register({
            ...registerInput,
            username: 'another-user',
        }),
    ).rejects.toMatchObject({
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'Email already exists',
    })
})

// Uses a default error when the response is not JSON.
it('uses a default error when the server returns HTML', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
        new Response('<html>Bad Gateway</html>', {
            status: 502,
            headers: {
                'Content-Type': 'text/html',
            },
        }),
    )
    vi.stubGlobal('fetch', fakeFetch)
    await expect(register(registerInput)).rejects.toMatchObject({
        code: 'HTTP_ERROR',
        message: 'Request failed (HTTP 502)',
    })
})

// Checks the login request and returned user.
it('returns the user after successful login', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(userResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }),
    )
    vi.stubGlobal('fetch', fakeFetch)
    const result = await login(loginInput)
    expect(result).toEqual(userResponse)
    expect(fakeFetch).toHaveBeenCalledTimes(1)
    expect(fakeFetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginInput),
        credentials: 'same-origin',
    })
})

// Preserves the backend error for invalid credentials.
it('rejects login with invalid credentials', async () => {
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
                headers: {
                    'Content-Type': 'application/json',
                },
            },
        ),
    )
    vi.stubGlobal('fetch', fakeFetch)
    await expect(login(loginInput)).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
    })
})

// Checks the current-user request and returned user.
it('returns the current user', async () => {
    const expected = {
        user: {
            id: 'test-user-id',
            email: 'test@example.com',
            username: 'test-user',
        },
    }
    const fakeFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(expected), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }),
    )
    vi.stubGlobal('fetch', fakeFetch)
    const result = await getMe()
    expect(result).toEqual(expected)
    expect(fakeFetch).toHaveBeenCalledTimes(1)
    expect(fakeFetch).toHaveBeenCalledWith('/api/auth/me', {
        credentials: 'same-origin',
    })
})

// Preserves the backend error when no user is authenticated.
it('rejects current-user lookup when not authenticated', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
        new Response(
            JSON.stringify({
                error: {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Authentication required',
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
    await expect(getMe()).rejects.toMatchObject({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
    })
})

// Accepts an empty logout response without parsing JSON.
it('logs out successfully with an empty response', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
        new Response(null, {
            status: 204,
        }),
    )
    vi.stubGlobal('fetch', fakeFetch)
    const result = await logout()
    expect(result).toBeUndefined()
    expect(fakeFetch).toHaveBeenCalledTimes(1)
    expect(fakeFetch).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
    })
})

// Preserves the backend error when logout fails.
it('rejects logout when the server returns an error', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
        new Response(
            JSON.stringify({
                error: {
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Internal server error',
                    details: {},
                },
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            },
        ),
    )
    vi.stubGlobal('fetch', fakeFetch)
    await expect(logout()).rejects.toMatchObject({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
    })
})
