import { Link } from 'react-router'
import { PageContainer } from '../components/layout/PageContainer'
import { t } from '../shared/i18n/translation'

// Shows a fallback page for unknown URLs.
export function NotFoundPage() {
    return (
        <PageContainer className="space-y-4">
            <h1 className="text-page-title">{t('notFound.title')}</h1>
            <p>{t('notFound.description')}</p>
            <Link className="tc-focus text-brand underline" to="/login">
                {t('notFound.actions.goToLogin')}
            </Link>
        </PageContainer>
    )
}
