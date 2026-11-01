import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Register shared session mocks and cleanup for App integration tests.
export function setupAppTests() {
    // Starts each test without an authenticated session.
    beforeEach(() => {
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
    })

    // Removes rendered components after each test.
    afterEach(() => {
        cleanup()
        vi.unstubAllGlobals()
    })
}
