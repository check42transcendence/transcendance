import type {
    RegisterInput,
    LoginInput,
    UserResponse,
} from '@tripcollab/shared'

import { apiClient, apiJson, apiPostJson } from '../lib/http/api-client'

// Sends registration data to the backend.
export function register(input: RegisterInput): Promise<UserResponse> {
    return apiPostJson<UserResponse>('/auth/register', input)
}

// Sends login credentials to the backend.
export function login(input: LoginInput): Promise<UserResponse> {
    return apiPostJson<UserResponse>('/auth/login', input)
}

// Loads the currently authenticated user.
export function getMe(): Promise<UserResponse> {
    return apiJson<UserResponse>('/auth/me')
}

// Asks the backend to end the current session.
export async function logout(): Promise<void> {
    await apiClient('/auth/logout', {
        method: 'POST',
    })
}
