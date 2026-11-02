import { readApiError } from './api-error'

// Sends API requests and throws an ApiError for HTTP failures.
export async function apiClient(
    path: string,
    options: RequestInit = {},
): Promise<Response> {
    const response = await fetch(`/api${path}`, {
        ...options,
        credentials: 'same-origin',
    })

    if (!response.ok) {
        throw await readApiError(response)
    }

    return response
}

// Sends an API request and reads its JSON response.
export async function apiJson<T>(
    path: string,
    options: RequestInit = {},
): Promise<T> {
    const response = await apiClient(path, options)
    const data: T = await response.json()

    return data
}

// Sends JSON data with POST and reads a JSON response.
export function apiPostJson<T>(path: string, data: unknown): Promise<T> {
    return apiJson<T>(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
}
