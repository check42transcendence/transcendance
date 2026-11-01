export interface ApiErrorResponse {
    error: {
        code: string
        message: string
        details?: unknown
    }
}