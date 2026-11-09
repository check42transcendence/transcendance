import type { UserSummary } from "./common.types.js"

// Public activity information returned by the backend.
export interface Activity {
    id: string
    tripId: string
    itineraryDayId: string
    proposalId: string | null

    title: string
    // Local HH:mm times; the date comes from the itinerary day.
    startTime: string
    endTime: string | null
    location: string | null
    description: string | null

    version: number

    createdBy: UserSummary
    updatedBy: UserSummary
    createdAt: string
    updatedAt: string
}

// Editable values sent when creating an activity.
export interface CreateActivityRequest {
    itineraryDayId: string
    title: string
    startTime: string
    endTime?: string | null
    location?: string | null
    description?: string | null
}

// Partial activity changes with the version originally loaded by the client.
export interface UpdateActivityRequest {
    expectedVersion: number
    // Include at least one editable field; use null to clear optional values.
    itineraryDayId?: string
    title?: string
    startTime?: string
    endTime?: string | null
    location?: string | null
    description?: string | null
}

// Identify the deleted activity and any proposal reopened by its deletion.
export interface DeleteActivityResult {
    deletedActivityId: string
    reopenedProposalId: string | null
}

// Response containing one activity.
export interface ActivityResponse {
    activity: Activity
}

// Response containing a trip's activities.
export interface ActivityListResponse {
    activities: Activity[]
}
