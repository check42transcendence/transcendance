// Error information returned by the backend.
import type { ApiErrorResponse } from '@tripcollab/shared'

// Stores an API error's message, code, status, and optional details.
export class ApiError extends Error {
    code: string
    status: number
    details: unknown

    constructor(
        message: string,
        code: string,
        status: number,
        details?: unknown,
    ) {
        super(message)
        this.name = 'ApiError'
        this.code = code
        this.status = status
        this.details = details
    }
}

// Reads backend errors or uses a default HTTP error.
export async function readApiError(response: Response): Promise<ApiError> {
    let message = `Request failed (HTTP ${response.status})`
    let code = 'HTTP_ERROR'
    let details: unknown = undefined

    try {
        const data: ApiErrorResponse = await response.json()

        if (
            typeof data.error.code === 'string' &&
            typeof data.error.message === 'string'
        ) {
            message = data.error.message
            code = data.error.code
            details = data.error.details
        }
    } catch {
        // Keep the default error if the response cannot be read as expected.
    }
    return new ApiError(message, code, response.status, details)
}
