import { randomUUID } from 'node:crypto'
import { test, expect } from '@playwright/test';

// Verifies the trip lifecycle against the real application.
test('completes the trip flow', async ({ page }) => {
    const suffix = randomUUID()
    const email = `e2e-${suffix}@example.com`
    const username = `e2e-${suffix}`
    const password = 'example-password'

    // Registers a new account.
    await page.goto('/register')

    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Username', { exact: true }).fill(username)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByLabel('Confirm password', { exact: true }).fill(password)

    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(
        page.getByText('Account created. Please sign in.'),
    ).toBeVisible()

    // Signs in with the newly registered account.
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(
        page.getByRole('heading', { name: 'Welcome back' }),
    ).toBeVisible()

    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)

    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(page).toHaveURL(/\/home$/)
    await expect(
        page.getByText(username, { exact: true }),
    ).toBeVisible()

    // Creates a trip through the form and opens its workspace.
    await page.getByRole('link', { name: 'Create trip' }).click()

    await expect(page).toHaveURL(/\/trips\/new$/)

    await page.getByLabel('Trip title', { exact: true }).fill('Paris weekend')
    await page.getByLabel('Trip destination', { exact: true }).fill('Paris')
    await page.getByLabel('Start date', { exact: true }).fill('2026-11-03')
    await page.getByLabel('End date', { exact: true }).fill('2026-11-04')

    await page.getByRole('button', { name: 'Create trip', exact: true }).click()

    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+$/)
    await expect(
        page.getByRole('heading', { name: 'Paris weekend', exact: true }),
    ).toBeVisible()

    // Shows the owner role and both generated itinerary days.
    const tripDetailsCard = page
        .getByRole('heading', {
            name: 'Paris weekend',
            exact: true,
        })
        .locator('..')

    await expect(
        tripDetailsCard.getByText('Owner', { exact: true }),
    ).toBeVisible()

    await expect(
        page.getByRole('heading', { name: 'Itinerary days', exact: true }),
    ).toBeVisible()

    await expect(page.getByText('Day 1', { exact: true })).toBeVisible()
    await expect(page.getByText('2026-11-03', { exact: true })).toBeVisible()

    await expect(page.getByText('Day 2', { exact: true })).toBeVisible()
    await expect(page.getByText('2026-11-04', { exact: true })).toBeVisible()

    // Reloads persisted trip details and days without losing the session.
    const workspaceUrl = page.url()

    await page.reload()

    await expect(page).toHaveURL(workspaceUrl)

    await expect(
        page.getByRole('heading', { name: 'Paris weekend', exact: true }),
    ).toBeVisible()

    await expect(
        tripDetailsCard.getByText('Owner', { exact: true }),
    ).toBeVisible()

    await expect(page.getByText('Day 1', { exact: true })).toBeVisible()
    await expect(page.getByText('Day 2', { exact: true })).toBeVisible()

    // Cancels deletion and keeps the trip visible.
    await page.getByRole('button', {
        name: 'Delete trip',
        exact: true,
    }).click()

    const deleteDialog = page.getByRole('dialog', {
        name: 'Delete this trip?',
        exact: true,
    })

    await expect(deleteDialog).toBeVisible()

    await deleteDialog.getByRole('button', {
        name: 'Cancel',
        exact: true,
    }).click()

    await expect(deleteDialog).not.toBeVisible()
    await expect(page).toHaveURL(workspaceUrl)

    await expect(
        page.getByRole('heading', { name: 'Paris weekend', exact: true }),
    ).toBeVisible()

    // Confirms deletion and returns to the updated trip list.
    await page.getByRole('button', {
        name: 'Delete trip',
        exact: true,
    }).click()

    await expect(deleteDialog).toBeVisible()

    await deleteDialog.getByRole('button', {
        name: 'Delete trip',
        exact: true,
    }).click()

    await expect(page).toHaveURL(/\/home$/)

    await expect(
        page.getByRole('heading', { name: 'No trips yet', exact: true }),
    ).toBeVisible()

    await expect(
        page.getByRole('link', { name: 'Paris weekend', exact: true }),
    ).toHaveCount(0)

    // Keeps the deleted trip absent after reloading Home.
    await page.reload()

    await expect(
        page.getByRole('heading', { name: 'No trips yet', exact: true }),
    ).toBeVisible()
})
