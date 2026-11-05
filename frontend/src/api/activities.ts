import type {
    ActivityListResponse,
    ActivityResponse,
    CreateActivityRequest,
    UpdateActivityRequest,
    DeleteActivityResult,
} from '@tripcollab/shared'
import { apiJson, apiPostJson } from '../lib/http/api-client'

// Load activities belonging to the current trip.
export function getActivities(
    tripId: string,
): Promise<ActivityListResponse> {
    return apiJson<ActivityListResponse>(`/trips/${tripId}/activities`)
}

// Create an activity within one of the trip's itinerary days.
export function createActivity(
    tripId: string,
    input: CreateActivityRequest,
): Promise<ActivityResponse> {
    return apiPostJson<ActivityResponse>(`/trips/${tripId}/activities`, input)
}

// Update editable activity fields using the version originally loaded.
export function updateActivity(
    tripId: string,
    activityId: string,
    input: UpdateActivityRequest,
): Promise<ActivityResponse> {
    return apiJson<ActivityResponse>(
        `/trips/${tripId}/activities/${activityId}`,
        {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(input),
        },
    )
}

// Delete an activity and report any proposal reopened by the backend.
export function deleteActivity(
    tripId: string,
    activityId: string,
): Promise<DeleteActivityResult> {
    return apiJson<DeleteActivityResult>(
        `/trips/${tripId}/activities/${activityId}`,
        {
            method: 'DELETE',
        },
    )
}

// Load the latest saved version of one activity.
export function getActivity(
    tripId: string,
    activityId: string,
): Promise<ActivityResponse> {
    return apiJson<ActivityResponse>(
        `/trips/${tripId}/activities/${activityId}`,
    )
}
