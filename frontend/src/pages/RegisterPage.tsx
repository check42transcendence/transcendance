import { useState, type SubmitEvent } from 'react'
import { PageContainer } from '../components/layout/PageContainer'
import { AuthHeader } from '../components/layout/AuthHeader'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { t } from '../shared/i18n/translation'
import type { RegisterInput } from '@tripcollab/shared'

type RegisterPageProps = {
    onSubmit: (credentials: RegisterInput) => Promise<void>
    loading?: boolean
    error?: string
    success?: string
    onLoginClick: () => void
}

// Displays the registration form and validates input before submission.
export function RegisterPage({
    onSubmit,
    loading = false,
    error,
    success,
    onLoginClick,
}: RegisterPageProps) {
    const [email, setEmail] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [validationError, setValidationError] = useState('')

    // Validates input before calling the parent submit handler.
    async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        setValidationError('')

        const normalizedEmail = email.trim()
        const normalizedUsername = username.trim()

        if (
            !normalizedEmail ||
            !normalizedUsername ||
            !password ||
            !confirmPassword
        ) {
            setValidationError(t('auth.register.validation.required'))
            return
        }

        if (Array.from(password).length < 8) {
            setValidationError(t('auth.shared.validation.passwordTooShort'))
            return
        }

        if (new TextEncoder().encode(password).length > 72) {
            setValidationError(t('auth.shared.validation.passwordTooLong'))
            return
        }

        if (password !== confirmPassword) {
            setValidationError(t('auth.register.validation.passwordMismatch'))
            return
        }

        // The parent handles API errors, loading state, and success messages.
        await onSubmit({
            email: normalizedEmail,
            username: normalizedUsername,
            password,
        })
    }

    return (
        <PageContainer size="compact">
            <AuthHeader />

            <Card className="space-y-5">
                <div>
                    <h2 className="text-card-title font-medium">
                        {t('auth.register.title')}
                    </h2>
                    <p className="text-muted mt-1">
                        {t('auth.register.description')}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label={t('auth.shared.fields.email')}
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder={t('auth.shared.placeholders.email')}
                        required
                        maxLength={254}
                        value={email}
                        disabled={loading}
                        onChange={(event) => {
                            setEmail(event.currentTarget.value)
                            setValidationError('')
                        }}
                    />

                    <Input
                        label={t('auth.register.fields.username')}
                        name="username"
                        type="text"
                        autoComplete="username"
                        placeholder={t('auth.register.placeholders.username')}
                        required
                        maxLength={50}
                        value={username}
                        disabled={loading}
                        onChange={(event) => {
                            setUsername(event.currentTarget.value)
                            setValidationError('')
                        }}
                    />

                    <Input
                        label={t('auth.shared.fields.password')}
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        placeholder={t('auth.register.placeholders.password')}
                        required
                        value={password}
                        disabled={loading}
                        onChange={(event) => {
                            setPassword(event.currentTarget.value)
                            setValidationError('')
                        }}
                    />

                    <Input
                        label={t('auth.register.fields.confirmPassword')}
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        placeholder={t(
                            'auth.register.placeholders.confirmPassword',
                        )}
                        required
                        value={confirmPassword}
                        disabled={loading}
                        onChange={(event) => {
                            setConfirmPassword(event.currentTarget.value)
                            setValidationError('')
                        }}
                    />

                    {(validationError || error) && (
                        <p role="alert" className="text-small text-danger">
                            {validationError || error}
                        </p>
                    )}

                    {success && (
                        <p role="status" className="text-small">
                            {success}
                        </p>
                    )}

                    <Button
                        type="submit"
                        className="w-full"
                        isLoading={loading}
                        disabled={loading}
                    >
                        {t('auth.shared.actions.createAccount')}
                    </Button>
                </form>

                <p className="text-small text-muted text-center">
                    {t('auth.register.hasAccount')}{' '}
                    <button
                        type="button"
                        onClick={onLoginClick}
                        disabled={loading}
                        className="font-medium text-brand underline"
                    >
                        {t('auth.shared.actions.signIn')}
                    </button>
                </p>
            </Card>
        </PageContainer>
    )
}
