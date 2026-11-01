import { apiJson, apiPostJson } from '../lib/http/api-client'
import type {
    TripListResponse,
    CreateTripInput,
    TripResponse,
} from '@tripcollab/shared'

// Load trips where the current user is a member.
export function getTrips(): Promise<TripListResponse> {
    return apiJson<TripListResponse>('/trips')
}

// Create a trip with its owner membership and itinerary days.
export function createTrip(input: CreateTripInput): Promise<TripResponse> {
    return apiPostJson<TripResponse>('/trips', input)
}
