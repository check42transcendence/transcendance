import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { HomePage } from './pages/HomePage'
import { CreateTripPage } from './pages/CreateTripPage'
import { TripWorkspacePage } from './pages/TripWorkspacePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { register, login, getMe, logout } from './api/auth'

import type { RegisterInput, LoginInput, CurrentUser } from '@tripcollab/shared'

import { ApiError } from './lib/http/api-error'
import { t } from './shared/i18n/translation'

function App() {
    const [loginLoading, setLoginLoading] = useState(false)
    const [loginError, setLoginError] = useState('')

    const [registerLoading, setRegisterLoading] = useState(false)
    const [registerError, setRegisterError] = useState('')
    const [registerSuccess, setRegisterSuccess] = useState('')

    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

    const [checkingSession, setCheckingSession] = useState(true)
    const [sessionError, setSessionError] = useState('')

    const [logoutLoading, setLogoutLoading] = useState(false)
    const [logoutError, setLogoutError] = useState('')

    const navigate = useNavigate()

    // Restores the current user when the app starts.
    useEffect(() => {
        let active = true

        async function loadCurrentUser(): Promise<void> {
            try {
                const result = await getMe()

                if (active) {
                    setCurrentUser(result.user)
                }
            } catch (error) {
                if (!active) return

                if (error instanceof ApiError && error.status === 401) {
                    setCurrentUser(null)
                } else {
                    setSessionError(t('auth.session.error'))
                }
            } finally {
                if (active) {
                    setCheckingSession(false)
                }
            }
        }

        void loadCurrentUser()

        return () => {
            active = false
        }
    }, [])

    // Registers a user and displays the result.
    async function handleRegister(input: RegisterInput): Promise<void> {
        setRegisterLoading(true)
        setRegisterError('')
        setRegisterSuccess('')

        try {
            await register(input)
            setRegisterSuccess(t('auth.register.success'))
        } catch (error) {
            setRegisterError(
                error instanceof Error
                    ? error.message
                    : t('auth.register.error'),
            )
        } finally {
            setRegisterLoading(false)
        }
    }

    // Logs in a user and opens the home page.
    async function handleLogin(input: LoginInput) {
        setLoginLoading(true)
        setLoginError('')

        try {
            const result = await login(input)
            setCurrentUser(result.user)
            navigate('/home', { replace: true })
        } catch (error) {
            setLoginError(
                error instanceof Error ? error.message : t('auth.login.error'),
            )
        } finally {
            setLoginLoading(false)
        }
    }

    // Clears the session and returns to login.
    async function handleLogout(): Promise<void> {
        setLogoutLoading(true)
        setLogoutError('')

        try {
            await logout()
            setCurrentUser(null)
            setLoginError('')
            navigate('/login', { replace: true })
        } catch (error) {
            setLogoutError(
                error instanceof Error ? error.message : t('auth.logout.error'),
            )
        } finally {
            setLogoutLoading(false)
        }
    }

    if (checkingSession) {
        return <p role="status">{t('auth.session.checking')}</p>
    }

    if (sessionError) {
        return (
            <main>
                <p role="alert">{sessionError}</p>
                <button type="button" onClick={() => window.location.reload()}>
                    {t('common.actions.retry')}
                </button>
            </main>
        )
    }

    return (
        <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />

            <Route
                path="/login"
                element={
                    <LoginPage
                        onSubmit={handleLogin}
                        loading={loginLoading}
                        error={loginError}
                        onRegisterClick={() => navigate('/register')}
                    />
                }
            />

            <Route
                path="/register"
                element={
                    <RegisterPage
                        onSubmit={handleRegister}
                        loading={registerLoading}
                        error={registerError}
                        success={registerSuccess}
                        onLoginClick={() => navigate('/login')}
                    />
                }
            />

            <Route
                path="/home"
                element={
                    currentUser ? (
                        <HomePage
                            username={currentUser.username}
                            onLogout={handleLogout}
                            logoutLoading={logoutLoading}
                            logoutError={logoutError}
                        />
                    ) : (
                        <Navigate to="/login" replace />
                    )
                }
            />

            {/* Allow only signed-in users to open trip creation. */}
            <Route
                path="/trips/new"
                element={
                    currentUser ? (
                        <CreateTripPage />
                    ) : (
                        <Navigate to="/login" replace />
                    )
                }
            />

            <Route
                path="/trips/:tripId"
                element={
                    currentUser ? (
                        <TripWorkspacePage />
                    ) : (
                        <Navigate to="/login" replace />
                    )
                }
            />

            <Route path="*" element={<NotFoundPage />} />
        </Routes>
    )
}

export default App
