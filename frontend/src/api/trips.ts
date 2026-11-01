import { apiClient, apiJson, apiPostJson } from '../lib/http/api-client'
import type {
    TripListResponse,
    CreateTripInput,
    TripResponse,
    TripDaysResponse,
} from '@tripcollab/shared'

// Load trips where the current user is a member.
export function getTrips(): Promise<TripListResponse> {
    return apiJson<TripListResponse>('/trips')
}

// Create a trip with its owner membership and itinerary days.
export function createTrip(input: CreateTripInput): Promise<TripResponse> {
    return apiPostJson<TripResponse>('/trips', input)
}

// Load trip details for a current member.
export function getTrip(tripId: string): Promise<TripResponse> {
    return apiJson<TripResponse>(`/trips/${tripId}`)
}

// Load the trip's generated itinerary days for a current member.
export function getTripDays(tripId: string): Promise<TripDaysResponse> {
    return apiJson<TripDaysResponse>(`/trips/${tripId}/days`)
}

// Delete the trip when the current user is its owner.
export async function deleteTrip(tripId: string): Promise<void> {
    await apiClient(`/trips/${tripId}`, {
        method: 'DELETE',
    })
}
