import { PageContainer } from '../components/layout/PageContainer'
import { t } from '../shared/i18n/translation'

// Provide the workspace destination before its feature UI is implemented.
export function TripWorkspacePage() {
    return (
        <PageContainer>
            <h1>{t('trips.workspace.title')}</h1>
        </PageContainer>
    )
}
