import { useState, type SubmitEvent } from 'react'
import { PageContainer } from '../components/layout/PageContainer'
import { AuthHeader } from '../components/layout/AuthHeader'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { t } from '../shared/i18n/translation'
import type { LoginInput } from '@tripcollab/shared'

type LoginPageProps = {
    onSubmit: (credentials: LoginInput) => Promise<void>
    loading?: boolean
    error?: string
    onRegisterClick: () => void
}

// Displays the login form and validates input before submission.
export function LoginPage({
    onSubmit,
    loading = false,
    error,
    onRegisterClick,
}: LoginPageProps) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [validationError, setValidationError] = useState('')

    // Validates input before calling the parent submit handler.
    async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        setValidationError('')

        const normalizedEmail = email.trim()

        if (!normalizedEmail || !password) {
            setValidationError(t('auth.login.validation.required'))
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

        // The parent handles API errors, loading state, and navigation.
        await onSubmit({
            email: normalizedEmail,
            password,
        })
    }

    return (
        <PageContainer>
            <AuthHeader />

            <Card className="space-y-5">
                <div>
                    <h2 className="text-card-title font-medium">
                        {t('auth.login.title')}
                    </h2>
                    <p className="text-muted mt-1">
                        {t('auth.login.description')}
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
                        label={t('auth.shared.fields.password')}
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        placeholder={t('auth.login.placeholders.password')}
                        required
                        value={password}
                        disabled={loading}
                        onChange={(event) => {
                            setPassword(event.currentTarget.value)
                            setValidationError('')
                        }}
                    />

                    {(validationError || error) && (
                        <p role="alert" className="text-small text-danger">
                            {validationError || error}
                        </p>
                    )}

                    <Button
                        type="submit"
                        className="w-full"
                        isLoading={loading}
                        disabled={loading}
                    >
                        {t('auth.shared.actions.signIn')}
                    </Button>
                </form>

                <p className="text-small text-muted text-center">
                    {t('auth.login.noAccount')}{' '}
                    <button
                        type="button"
                        onClick={onRegisterClick}
                        disabled={loading}
                        className="font-medium text-brand underline"
                    >
                        {t('auth.shared.actions.createAccount')}
                    </button>
                </p>
            </Card>
        </PageContainer>
    )
}
