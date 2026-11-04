import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProposal, getProposal, getProposals } from './proposals'

afterEach(() => {
    vi.unstubAllGlobals()
})

function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

describe('Proposal API', () => {
    it('loads Proposals from the specified Trip', async () => {
        const fakeFetch = vi
            .fn()
            .mockResolvedValue(jsonResponse({ proposals: [] }))

        vi.stubGlobal('fetch', fakeFetch)

        expect(await getProposals('trip-1')).toEqual({
            proposals: [],
        })

        expect(fakeFetch).toHaveBeenCalledWith('/api/trips/trip-1/proposals', {
            credentials: 'same-origin',
        })
    })

    it('loads one Proposal with both resource IDs', async () => {
        const fakeFetch = vi
            .fn()
            .mockResolvedValue(jsonResponse({ proposal: { id: 'proposal-1' } }))

        vi.stubGlobal('fetch', fakeFetch)

        expect(await getProposal('trip-1', 'proposal-1')).toEqual({
            proposal: { id: 'proposal-1' },
        })

        expect(fakeFetch).toHaveBeenCalledWith(
            '/api/trips/trip-1/proposals/proposal-1',
            { credentials: 'same-origin' },
        )
    })

    it('creates a Proposal using POST JSON', async () => {
        const fakeFetch = vi
            .fn()
            .mockResolvedValue(
                jsonResponse({ proposal: { id: 'proposal-1' } }, 201),
            )

        vi.stubGlobal('fetch', fakeFetch)

        await createProposal('trip-1', {
            title: 'Visit Louvre',
            description: null,
        })

        expect(fakeFetch).toHaveBeenCalledWith('/api/trips/trip-1/proposals', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title: 'Visit Louvre',
                description: null,
            }),
        })
    })

    it('propagates backend errors to the caller', async () => {
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

        await expect(getProposals('trip-1')).rejects.toMatchObject({
            code: 'TRIP_NOT_FOUND',
            status: 404,
        })
    })
})
