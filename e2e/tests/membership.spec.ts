
import { randomUUID } from 'node:crypto'

import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const password = 'example-password'

const baseURL =
    process.env.E2E_BASE_URL ??
    'https://transcendence-e2e-frontend-1'

// Register and sign in one independent user.
async function registerAndLogin(
    page: Page,
    email: string,
    username: string,
): Promise<void> {
    await page.goto('/register')

    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Username', { exact: true }).fill(username)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByLabel('Confirm password', { exact: true }).fill(password)

    await page.getByRole('button', {
        name: 'Create account',
        exact: true,
    }).click()

    await expect(
        page.getByText('Account created. Please sign in.'),
    ).toBeVisible()

    await page.getByRole('button', {
        name: 'Sign in',
        exact: true,
    }).click()

    await expect(
        page.getByRole('heading', { name: 'Welcome back' }),
    ).toBeVisible()

    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)

    await page.getByRole('button', {
        name: 'Sign in',
        exact: true,
    }).click()

    await expect(page).toHaveURL(/\/home$/)
    await expect(page.getByText(username, { exact: true })).toBeVisible()
}

// Format dates using the local calendar date for date inputs.
function formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
}

test('completes the membership invitation and leave journey', async ({
    browser,
}) => {
    const suffix = randomUUID()

    const ownerEmail = `owner-${suffix}@example.com`
    const ownerUsername = `owner-${suffix}`

    const memberEmail = `member-${suffix}@example.com`
    const memberUsername = `member-${suffix}`

    const tripTitle = `Membership E2E ${suffix.slice(0, 8)}`

    // Two independent browser contexts preserve separate login sessions.
    const ownerContext = await browser.newContext({
        baseURL,
        ignoreHTTPSErrors: true,
    })

    const memberContext = await browser.newContext({
        baseURL,
        ignoreHTTPSErrors: true,
    })

    try {
        const ownerPage = await ownerContext.newPage()
        const memberPage = await memberContext.newPage()

        // Register the Owner and create a Trip.
        await registerAndLogin(
            ownerPage,
            ownerEmail,
            ownerUsername,
        )

        // Register the Member before the Owner sends the invitation.
        await registerAndLogin(
            memberPage,
            memberEmail,
            memberUsername,
        )

        await ownerPage.getByRole('link', {
            name: 'Create trip',
        }).click()

        await expect(ownerPage).toHaveURL(/\/trips\/new$/)

        const startDate = new Date()
        startDate.setDate(startDate.getDate() + 14)

        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + 1)

        await ownerPage.getByLabel('Trip title', {
            exact: true,
        }).fill(tripTitle)

        await ownerPage.getByLabel('Trip destination', {
            exact: true,
        }).fill('Paris')

        await ownerPage.getByLabel('Start date', {
            exact: true,
        }).fill(formatDate(startDate))

        await ownerPage.getByLabel('End date', {
            exact: true,
        }).fill(formatDate(endDate))

        await ownerPage.getByRole('button', {
            name: 'Create trip',
            exact: true,
        }).click()

        await expect(ownerPage).toHaveURL(/\/trips\/[0-9a-f-]+$/)

        const workspaceUrl = ownerPage.url()

        // Owner invites the second registered user.
        await ownerPage.getByRole('button', {
            name: 'Invite member',
            exact: true,
        }).click()

        const inviteDialog = ownerPage.getByRole('dialog', {
            name: 'Invite a member',
        })

        await expect(inviteDialog).toBeVisible()

        await inviteDialog.getByLabel('Username', {
            exact: true,
        }).fill(memberUsername)

        await inviteDialog.getByRole('button', {
            name: 'Invite member',
            exact: true,
        }).click()

        await expect(
            inviteDialog.getByText('Invitation sent.', {
                exact: true,
            }),
        ).toBeVisible()

        // Reload Home to fetch the newly created invitation.
        await memberPage.reload()

        // A pending invitation must not grant Workspace access.
        await expect(
            memberPage.getByRole('heading', {
                name: tripTitle,
                exact: true,
            }),
        ).toBeVisible()

        await expect(
            memberPage.getByRole('link', {
                name: tripTitle,
                exact: true,
            }),
        ).toHaveCount(0)

        // Accept the invitation.
        await memberPage.getByRole('button', {
            name: 'Accept',
            exact: true,
        }).click()

        await expect(
            memberPage.getByRole('link', {
                name: tripTitle,
                exact: true,
            }),
        ).toBeVisible()

        await expect(
            memberPage.getByRole('button', {
                name: 'Accept',
                exact: true,
            }),
        ).toHaveCount(0)

        // The Owner can see the new Member after refreshing Workspace.
        await ownerPage.reload()

        await expect(
            ownerPage.getByText(memberUsername, {
                exact: true,
            }),
        ).toBeVisible()

        // Member opens the newly accessible Workspace.
        await memberPage.getByRole('link', {
            name: tripTitle,
            exact: true,
        }).click()

        await expect(memberPage).toHaveURL(/\/trips\/[0-9a-f-]+$/)

        await expect(
            memberPage.getByRole('heading', {
                name: tripTitle,
                exact: true,
            }),
        ).toBeVisible()

        await expect(
            memberPage.getByRole('heading', {
                name: 'Members',
                exact: true,
            }),
        ).toBeVisible()

        const membersSection = memberPage
            .getByRole('heading', { name: 'Members', exact: true })
            .locator('..')

        await expect(
            membersSection.getByText('Member', { exact: true }),
        ).toBeVisible()

        // Member leaves the Trip.
        await memberPage.getByRole('button', {
            name: 'Leave trip',
            exact: true,
        }).click()

        const leaveDialog = memberPage.getByRole('dialog', {
            name: 'Leave this trip?',
        })

        await expect(leaveDialog).toBeVisible()

        await leaveDialog.getByRole('button', {
            name: 'Leave trip',
            exact: true,
        }).click()

        await expect(memberPage).toHaveURL(/\/home$/)

        await expect(
            memberPage.getByRole('link', {
                name: tripTitle,
                exact: true,
            }),
        ).toHaveCount(0)

        // Direct access to the old Workspace must also be denied.
        await memberPage.goto(workspaceUrl)

        await expect(
            memberPage.getByText(
                'This trip does not exist or you do not have access.',
                { exact: true },
            ),
        ).toBeVisible()

        // The Owner still has access, but the departed Member is gone.
        await ownerPage.reload()

        await expect(
            ownerPage.getByText(memberUsername, {
                exact: true,
            }),
        ).toHaveCount(0)
    } finally {
        await ownerContext.close()
        await memberContext.close()
    }
})
