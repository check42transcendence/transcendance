import { afterEach, expect, it, vi } from 'vitest'
import { apiClient, apiJson, apiPostJson } from './api-client'
import { ApiError } from './api-error'

// Restores the real fetch after each test.
afterEach(() => {
    vi.unstubAllGlobals()
})

// Checks the API prefix, cookie configuration, and returned response.
it('adds the API prefix and uses same-origin credentials', async () => {
    const response = new Response(null, { status: 200 })
    const fakeFetch = vi.fn().mockResolvedValue(response)

    vi.stubGlobal('fetch', fakeFetch)

    const result = await apiClient('/example')

    expect(fakeFetch).toHaveBeenCalledTimes(1)
    expect(fakeFetch).toHaveBeenCalledWith('/api/example', {
        credentials: 'same-origin',
    })
    expect(result).toBe(response)
})

// Preserves the caller's request method, headers, and body.
it('preserves request options', async () => {
    const response = new Response(null, { status: 204 })
    const fakeFetch = vi.fn().mockResolvedValue(response)

    vi.stubGlobal('fetch', fakeFetch)

    await apiClient('/example', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"name":"example"}',
    })

    expect(fakeFetch).toHaveBeenCalledWith('/api/example', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"name":"example"}',
        credentials: 'same-origin',
    })
})

// Preserves the backend error message, code, and HTTP status.
it('throws an ApiError for a backend error response', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
        new Response(
            JSON.stringify({
                error: {
                    code: 'EXAMPLE_CONFLICT',
                    message: 'Example conflict',
                    details: { field: 'name' },
                },
            }),
            {
                status: 409,
                headers: { 'Content-Type': 'application/json' },
            },
        ),
    )

    vi.stubGlobal('fetch', fakeFetch)

    const request = apiClient('/example')

    await expect(request).rejects.toBeInstanceOf(ApiError)
    await expect(request).rejects.toMatchObject({
        code: 'EXAMPLE_CONFLICT',
        message: 'Example conflict',
        status: 409,
        details: { field: 'name' },
    })
})

// Uses a default error when the server returns HTML.
it('throws a default ApiError for an HTML error response', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
        new Response('<html>Bad Gateway</html>', {
            status: 502,
            headers: { 'Content-Type': 'text/html' },
        }),
    )

    vi.stubGlobal('fetch', fakeFetch)

    const request = apiClient('/example')

    await expect(request).rejects.toBeInstanceOf(ApiError)
    await expect(request).rejects.toMatchObject({
        code: 'HTTP_ERROR',
        message: 'Request failed (HTTP 502)',
        status: 502,
    })
})

// Parses a successful JSON response.
it('returns parsed JSON data', async () => {
    const expected = { message: 'Hello' }

    const fakeFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(expected), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }),
    )

    vi.stubGlobal('fetch', fakeFetch)

    const result = await apiJson<{ message: string }>('/example')

    expect(result).toEqual(expected)
})

// Sends JSON data with POST and parses the JSON response.
it('posts JSON data and returns the parsed response', async () => {
    const input = { name: 'example' }
    const expected = { id: 'example-id', name: 'example' }

    const fakeFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(expected), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        }),
    )

    vi.stubGlobal('fetch', fakeFetch)

    const result = await apiPostJson<{ id: string; name: string }>(
        '/example',
        input,
    )

    expect(result).toEqual(expected)
    expect(fakeFetch).toHaveBeenCalledTimes(1)
    expect(fakeFetch).toHaveBeenCalledWith('/api/example', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        credentials: 'same-origin',
    })
})
