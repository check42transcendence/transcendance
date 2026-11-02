import type { MembershipRole, UserSummary } from './common.types.js'

// Public trip information shown in the user's trip list.
export interface TripSummary {
    id: string
    title: string
    destination: string
    startDate: string
    endDate: string
    description: string | null
    currentUserRole: MembershipRole
}

// Response containing the current user's trips.
export interface TripListResponse {
    trips: TripSummary[]
}

// Data sent when creating a trip.
export interface CreateTripInput {
    title: string
    destination: string
    startDate: string
    endDate: string
    description?: string | null
}

// Public trip details, including the creator and creation time.
export interface TripDetail extends TripSummary {
    createdBy: UserSummary
    createdAt: string
}

// Response containing one trip's public details.
export interface TripResponse {
    trip: TripDetail
}

// Public information about one fixed itinerary day.
export interface ItineraryDay {
    id: string
    tripId: string
    dayNumber: number
    date: string
}

// Response containing a trip's itinerary days.
export interface TripDaysResponse {
    days: ItineraryDay[]
}
