import { delay, http, HttpResponse } from 'msw'
import type {
    Activity,
    CreateActivityRequest,
    UpdateActivityRequest,
} from '@tripcollab/shared'

// Trigger one conflict per activity on its first update. Reload after changing.
const SIMULATE_CONFLICT_ONCE = false
// Fail create, update, and delete requests with HTTP 503.
const SIMULATE_WRITE_ERROR = false

// Keep mock data in memory. Reloading the page clears it.
let activities: Activity[] = []
// Remember which activities have already received a simulated conflict.
const conflictedIds = new Set<string>()

// Use a fixed author for visual development only.
const mockUser = {
    id: 'mock-user',
    username: 'Preview user',
}

// Return the same error structure as the real API.
function errorResponse(
    status: number,
    code: string,
    message: string,
) {
    return HttpResponse.json(
        {
            error: {
                code,
                message,
                details: {},
            },
        },
        { status },
    )
}

// Preview CRUD with a short delay; permissions and Proposal reopening are not simulated.
export const activityHandlers = [
    // Return activities belonging to the requested trip.
    http.get('/api/trips/:tripId/activities', async ({ params }) => {
        await delay(500)

        return HttpResponse.json({
            activities: activities.filter(
                (activity) => activity.tripId === params.tripId,
            ),
        })
    }),

    // Return one activity, including its latest version.
    http.get(
        '/api/trips/:tripId/activities/:activityId',
        async ({ params }) => {
            await delay(500)

            const activity = activities.find(
                (item) =>
                    item.tripId === params.tripId &&
                    item.id === params.activityId,
            )

            if (!activity) {
                return errorResponse(
                    404,
                    'ACTIVITY_NOT_FOUND',
                    'Activity not found',
                )
            }

            return HttpResponse.json({ activity })
        },
    ),

    // Create an activity using the values submitted by the form.
    http.post(
        '/api/trips/:tripId/activities',
        async ({ params, request }) => {
            await delay(500)

            if (SIMULATE_WRITE_ERROR) {
                return errorResponse(
                    503,
                    'MOCK_SERVICE_UNAVAILABLE',
                    'Simulated request failure',
                )
            }

            const input =
                (await request.json()) as CreateActivityRequest
            const now = new Date().toISOString()

            const activity: Activity = {
                id: crypto.randomUUID(),
                tripId: String(params.tripId),
                itineraryDayId: input.itineraryDayId,
                proposalId: null,
                title: input.title,
                startTime: input.startTime,
                endTime: input.endTime ?? null,
                location: input.location ?? null,
                description: input.description ?? null,
                version: 1,
                createdBy: mockUser,
                updatedBy: mockUser,
                createdAt: now,
                updatedAt: now,
            }

            activities.push(activity)

            return HttpResponse.json({ activity }, { status: 201 })
        },
    ),

    // Reject stale versions or save the submitted changes.
    http.patch(
        '/api/trips/:tripId/activities/:activityId',
        async ({ params, request }) => {
            await delay(500)

            if (SIMULATE_WRITE_ERROR) {
                return errorResponse(
                    503,
                    'MOCK_SERVICE_UNAVAILABLE',
                    'Simulated request failure',
                )
            }

            const activity = activities.find(
                (item) =>
                    item.tripId === params.tripId &&
                    item.id === params.activityId,
            )

            if (!activity) {
                return errorResponse(
                    404,
                    'ACTIVITY_NOT_FOUND',
                    'Activity not found',
                )
            }

            const input =
                (await request.json()) as UpdateActivityRequest

            // Simulate another member updating this activity once.
            if (
                SIMULATE_CONFLICT_ONCE &&
                !conflictedIds.has(activity.id)
            ) {
                activity.title = `${activity.title} (updated by another member)`
                activity.version += 1
                activity.updatedBy = {
                    id: 'mock-other-user',
                    username: 'Another member',
                }
                activity.updatedAt = new Date().toISOString()
                conflictedIds.add(activity.id)
            }

            if (input.expectedVersion !== activity.version) {
                return errorResponse(
                    409,
                    'ACTIVITY_VERSION_CONFLICT',
                    'Activity was updated by someone else',
                )
            }

            // Omitted fields stay unchanged; null clears optional values.
            if (input.itineraryDayId !== undefined) {
                activity.itineraryDayId = input.itineraryDayId
            }
            if (input.title !== undefined) {
                activity.title = input.title
            }
            if (input.startTime !== undefined) {
                activity.startTime = input.startTime
            }
            if (input.endTime !== undefined) {
                activity.endTime = input.endTime
            }
            if (input.location !== undefined) {
                activity.location = input.location
            }
            if (input.description !== undefined) {
                activity.description = input.description
            }

            activity.version += 1
            activity.updatedBy = mockUser
            activity.updatedAt = new Date().toISOString()

            return HttpResponse.json({ activity })
        },
    ),

    // Delete an activity without changing the real database.
    http.delete(
        '/api/trips/:tripId/activities/:activityId',
        async ({ params }) => {
            await delay(500)

            if (SIMULATE_WRITE_ERROR) {
                return errorResponse(
                    503,
                    'MOCK_SERVICE_UNAVAILABLE',
                    'Simulated request failure',
                )
            }

            const activity = activities.find(
                (item) =>
                    item.tripId === params.tripId &&
                    item.id === params.activityId,
            )

            if (!activity) {
                return errorResponse(
                    404,
                    'ACTIVITY_NOT_FOUND',
                    'Activity not found',
                )
            }

            activities = activities.filter(
                (item) => item.id !== activity.id,
            )

            return HttpResponse.json({
                deletedActivityId: activity.id,
                reopenedProposalId: null,
            })
        },
    ),
]
