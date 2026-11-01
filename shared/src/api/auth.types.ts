export interface RegisterInput {
	email: string
	username: string
	password: string
}

// Data sent when logging in.
export interface LoginInput {
	email: string
	password: string
}

// Public information about the current user.
export interface CurrentUser {
	id: string
	email: string
	username: string
}

// Response containing public user information.
export interface UserResponse {
	user: CurrentUser
}