// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest'
import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react'
import type {
    Activity,
    CreateActivityRequest,
    ItineraryDay,
    UpdateActivityRequest,
} from '@tripcollab/shared'
import { TripItinerarySection } from './TripItinerarySection'

const tripId = 'test-trip-id'
const activitiesPath = `/api/trips/${tripId}/activities`

// Fixed days supplied by the Workspace page.
const days: ItineraryDay[] = [
    { id: 'day-1', tripId, dayNumber: 1, date: '2026-11-05' },
    { id: 'day-2', tripId, dayNumber: 2, date: '2026-11-06' },
    { id: 'day-3', tripId, dayNumber: 3, date: '2026-11-07' },
]

// Reuse saved activity fields while keeping each scenario independent.
function makeActivity(overrides: Partial<Activity> = {}): Activity {
    return {
        id: 'activity-1',
        tripId,
        itineraryDayId: days[0].id,
        proposalId: null,
        title: 'Museum visit',
        startTime: '09:30',
        endTime: '11:00',
        location: 'Museum',
        description: 'Meet at the entrance.',
        version: 7,
        createdBy: { id: 'creator-id', username: 'yihe' },
        updatedBy: { id: 'editor-id', username: 'weiyang' },
        createdAt: '2026-11-05T08:00:00.000Z',
        updatedAt: '2026-11-05T09:00:00.000Z',
        ...overrides,
    }
}

// Preserve dialog methods before adding the JSDOM substitutes.
const originalDialogMethods = {
    showModal: Object.getOwnPropertyDescriptor(
        HTMLDialogElement.prototype,
        'showModal',
    ),
    close: Object.getOwnPropertyDescriptor(
        HTMLDialogElement.prototype,
        'close',
    ),
}

// Support the same dialog opening and closing used by the real component.
beforeAll(() => {
    Object.defineProperties(HTMLDialogElement.prototype, {
        showModal: {
            configurable: true,
            value: function (this: HTMLDialogElement) {
                this.open = true
            },
        },
        close: {
            configurable: true,
            value: function (this: HTMLDialogElement) {
                this.open = false
            },
        },
    })
})

// Restore the environment instead of leaving dialog substitutes installed.
afterAll(() => {
    for (const [name, descriptor] of Object.entries(originalDialogMethods)) {
        if (descriptor) {
            Object.defineProperty(HTMLDialogElement.prototype, name, descriptor)
        } else {
            Reflect.deleteProperty(HTMLDialogElement.prototype, name)
        }
    }
})

// Remove the previous page and fetch mock after every test.
afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
})

// Return a fresh response so its body can be read once per request.
function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

// Use the real API error envelope for failure and conflict scenarios.
function errorResponse(code: string, status: number): Response {
    return jsonResponse(
        { error: { code, message: 'Test request failed', details: {} } },
        status,
    )
}

type RequestOptions = {
    activities?: Activity[]
    latestActivity?: Activity
    onCreate?: (input: CreateActivityRequest) => Response
    onUpdate?: (input: UpdateActivityRequest) => Response
}

// Match requests by endpoint and method, independently of request order.
function mockActivityRequests({
    activities = [],
    latestActivity,
    onCreate,
    onUpdate,
}: RequestOptions = {}) {
    const fakeFetch = vi.fn(async (url: string, options?: RequestInit) => {
        const method = options?.method ?? 'GET'

        if (url === activitiesPath && method === 'GET') {
            return jsonResponse({ activities })
        }

        if (url === activitiesPath && method === 'POST' && onCreate) {
            const input = JSON.parse(
                String(options?.body),
            ) as CreateActivityRequest
            return onCreate(input)
        }

        const activity = activities.find(
            (item) => url === `${activitiesPath}/${item.id}`,
        )

        if (activity && method === 'GET') {
            return jsonResponse({ activity: latestActivity ?? activity })
        }

        if (activity && method === 'PATCH' && onUpdate) {
            const input = JSON.parse(
                String(options?.body),
            ) as UpdateActivityRequest
            return onUpdate(input)
        }

        if (activity && method === 'DELETE') {
            return jsonResponse({
                deletedActivityId: activity.id,
                reopenedProposalId: null,
            })
        }

        throw new Error(`Unexpected test request: ${method} ${url}`)
    })

    vi.stubGlobal('fetch', fakeFetch)
    return fakeFetch
}

// Find a day's list item without including activities from other days.
function getDay(dayNumber: number): HTMLElement {
    const day = screen
        .getByRole('heading', { name: `Day ${dayNumber}`, level: 3 })
        .closest('li')

    if (!day) throw new Error(`Day ${dayNumber} was not rendered`)
    return day
}

// Change fields through the same labeled controls used by the user.
function fillActivityForm(
    dialog: HTMLElement,
    values: {
        title: string
        startTime: string
        endTime?: string
        location?: string
        description?: string
    },
): void {
    const controls = within(dialog)
    fireEvent.change(controls.getByLabelText('Activity title'), {
        target: { value: values.title },
    })
    fireEvent.change(controls.getByLabelText('Start time'), {
        target: { value: values.startTime },
    })

    if (values.endTime !== undefined) {
        fireEvent.change(controls.getByLabelText('End time (optional)'), {
            target: { value: values.endTime },
        })
    }
    if (values.location !== undefined) {
        fireEvent.change(controls.getByLabelText('Location (optional)'), {
            target: { value: values.location },
        })
    }
    if (values.description !== undefined) {
        fireEvent.change(controls.getByLabelText('Description (optional)'), {
            target: { value: values.description },
        })
    }
}

// Group by day and sort by time even when the server returns another order.
it('groups activities by day and sorts them by start time', async () => {
    mockActivityRequests({
        activities: [
            makeActivity({
                id: 'afternoon',
                title: 'City walk',
                startTime: '14:00',
            }),
            makeActivity(),
            makeActivity({
                id: 'second-day',
                itineraryDayId: days[1].id,
                title: 'Train journey',
            }),
        ],
    })
    render(<TripItinerarySection tripId={tripId} days={days} />)

    await screen.findByRole('heading', { name: 'Museum visit', level: 4 })

    const firstDay = within(getDay(1))
    const secondDay = within(getDay(2))
    expect(
        firstDay
            .getAllByRole('heading', { level: 4 })
            .map((heading) => heading.textContent),
    ).toEqual(['Museum visit', 'City walk'])
    expect(
        secondDay.getByRole('heading', { name: 'Train journey' }),
    ).not.toBeNull()
    expect(
        firstDay.queryByRole('heading', { name: 'Train journey' }),
    ).toBeNull()
    expect(
        secondDay.queryByRole('heading', { name: 'Museum visit' }),
    ).toBeNull()
    expect(firstDay.getAllByText('Created by: yihe')).toHaveLength(2)
    expect(firstDay.getAllByText('Updated by: weiyang')).toHaveLength(2)
    expect(
        within(getDay(3)).getByRole('heading', { name: 'No activities yet.' }),
    ).not.toBeNull()
})

// Create in the selected day and display the activity returned by the server.
it('creates an activity in the selected day', async () => {
    const createInput: CreateActivityRequest = {
        itineraryDayId: days[1].id,
        title: 'Gallery visit',
        startTime: '10:00',
        endTime: null,
        location: null,
        description: null,
    }
    const createdActivity = makeActivity({
        ...createInput,
        id: 'new-activity',
        version: 1,
    })
    const onCreate = vi.fn(() =>
        jsonResponse({ activity: createdActivity }, 201),
    )
    mockActivityRequests({ onCreate })
    render(<TripItinerarySection tripId={tripId} days={days} />)

    await within(getDay(2)).findByRole('heading', {
        name: 'No activities yet.',
    })
    fireEvent.click(
        within(getDay(2)).getByRole('button', { name: 'Add activity' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Add activity' })
    fillActivityForm(dialog, { title: '  Gallery visit  ', startTime: '10:00' })
    fireEvent.click(
        within(dialog).getByRole('button', { name: 'Add activity' }),
    )

    await within(getDay(2)).findByRole('heading', {
        name: 'Gallery visit',
        level: 4,
    })
    expect(onCreate).toHaveBeenCalledExactlyOnceWith(createInput)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(
        within(getDay(1)).queryByRole('heading', { name: 'Gallery visit' }),
    ).toBeNull()
})

// Preserve all entered values after failure and allow the same draft to retry.
it('keeps the create draft after failure and allows retry', async () => {
    const createdActivity = makeActivity({ title: 'Gallery visit', version: 1 })
    const onCreate = vi
        .fn()
        .mockImplementationOnce(() => errorResponse('INTERNAL_ERROR', 500))
        .mockImplementationOnce(() =>
            jsonResponse({ activity: createdActivity }, 201),
        )
    mockActivityRequests({ onCreate })
    render(<TripItinerarySection tripId={tripId} days={days} />)

    await within(getDay(1)).findByRole('heading', {
        name: 'No activities yet.',
    })
    fireEvent.click(
        within(getDay(1)).getByRole('button', { name: 'Add activity' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Add activity' })
    const draft = {
        title: 'Gallery visit',
        startTime: '10:00',
        endTime: '11:00',
        location: 'Gallery',
        description: 'Meet outside.',
    }
    fillActivityForm(dialog, draft)
    fireEvent.click(
        within(dialog).getByRole('button', { name: 'Add activity' }),
    )

    const alert = await within(dialog).findByRole('alert')
    expect(alert.textContent).toBe(
        'Unable to create the activity. Please try again.',
    )
    expect(
        (within(dialog).getByLabelText('Activity title') as HTMLInputElement)
            .value,
    ).toBe(draft.title)
    expect(
        (within(dialog).getByLabelText('Start time') as HTMLInputElement).value,
    ).toBe(draft.startTime)
    expect(
        (
            within(dialog).getByLabelText(
                'End time (optional)',
            ) as HTMLInputElement
        ).value,
    ).toBe(draft.endTime)
    expect(
        (
            within(dialog).getByLabelText(
                'Location (optional)',
            ) as HTMLInputElement
        ).value,
    ).toBe(draft.location)
    expect(
        (
            within(dialog).getByLabelText(
                'Description (optional)',
            ) as HTMLTextAreaElement
        ).value,
    ).toBe(draft.description)

    fireEvent.click(
        within(dialog).getByRole('button', { name: 'Add activity' }),
    )
    await screen.findByRole('heading', { name: 'Gallery visit', level: 4 })
    expect(onCreate).toHaveBeenCalledTimes(2)
    expect(onCreate).toHaveBeenNthCalledWith(2, {
        itineraryDayId: days[0].id,
        ...draft,
    })
    expect(screen.queryByRole('dialog')).toBeNull()
})

// Send the loaded version and move the saved activity to its new day.
it('updates an activity using its original version', async () => {
    const originalActivity = makeActivity()
    const updateInput: UpdateActivityRequest = {
        expectedVersion: originalActivity.version,
        itineraryDayId: days[1].id,
        title: 'Evening museum visit',
        startTime: '17:00',
        endTime: null,
        location: null,
        description: null,
    }
    const updatedActivity = makeActivity({
        itineraryDayId: days[1].id,
        title: 'Evening museum visit',
        startTime: '17:00',
        endTime: null,
        location: null,
        description: null,
        version: 8,
    })
    const onUpdate = vi.fn(() => jsonResponse({ activity: updatedActivity }))
    mockActivityRequests({ activities: [originalActivity], onUpdate })
    render(<TripItinerarySection tripId={tripId} days={days} />)

    await screen.findByRole('heading', {
        name: originalActivity.title,
        level: 4,
    })
    fireEvent.click(
        within(getDay(1)).getByRole('button', { name: 'Edit activity' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Edit activity' })
    expect(
        (within(dialog).getByLabelText('Activity title') as HTMLInputElement)
            .value,
    ).toBe(originalActivity.title)
    expect(
        (
            within(dialog).getByLabelText(
                'Location (optional)',
            ) as HTMLInputElement
        ).value,
    ).toBe(originalActivity.location)
    fireEvent.change(within(dialog).getByLabelText('Day'), {
        target: { value: days[1].id },
    })
    fillActivityForm(dialog, {
        title: '  Evening museum visit  ',
        startTime: '17:00',
        endTime: '',
        location: '',
        description: '',
    })
    fireEvent.click(
        within(dialog).getByRole('button', { name: 'Save changes' }),
    )

    await within(getDay(2)).findByRole('heading', {
        name: updatedActivity.title,
        level: 4,
    })
    expect(onUpdate).toHaveBeenCalledExactlyOnceWith(updateInput)
    expect(
        within(getDay(1)).queryByRole('heading', {
            name: originalActivity.title,
        }),
    ).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
})

// Keep a stale draft until the user explicitly adopts the latest saved values.
it('preserves a conflicting draft until the user chooses the latest version', async () => {
    const originalActivity = makeActivity()
    const latestActivity = makeActivity({
        title: 'Updated by another member',
        version: 8,
    })
    const savedActivity = {
        ...latestActivity,
        title: 'My revised title',
        version: 9,
    }
    const onUpdate = vi.fn((input: UpdateActivityRequest) => {
        if (input.expectedVersion === originalActivity.version) {
            return errorResponse('ACTIVITY_VERSION_CONFLICT', 409)
        }
        return jsonResponse({ activity: savedActivity })
    })
    const fakeFetch = mockActivityRequests({
        activities: [originalActivity],
        latestActivity,
        onUpdate,
    })
    render(<TripItinerarySection tripId={tripId} days={days} />)

    await screen.findByRole('heading', {
        name: originalActivity.title,
        level: 4,
    })
    fireEvent.click(
        within(getDay(1)).getByRole('button', { name: 'Edit activity' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Edit activity' })
    const titleInput = within(dialog).getByLabelText(
        'Activity title',
    ) as HTMLInputElement
    const saveButton = within(dialog).getByRole('button', {
        name: 'Save changes',
    })
    fireEvent.change(titleInput, { target: { value: 'My unsaved title' } })
    fireEvent.click(saveButton)

    const alert = await within(dialog).findByRole('alert')
    expect(alert.textContent).toBe(
        'This activity was updated by someone else. Your changes have been kept. Review the latest version before saving again.',
    )
    expect(titleInput.value).toBe('My unsaved title')
    expect(saveButton.hasAttribute('disabled')).toBe(true)

    fireEvent.click(
        within(dialog).getByRole('button', { name: 'View latest version' }),
    )
    await within(dialog).findByText(latestActivity.title)
    expect(titleInput.value).toBe('My unsaved title')
    expect(saveButton.hasAttribute('disabled')).toBe(true)
    expect(fakeFetch).toHaveBeenCalledWith(
        `${activitiesPath}/${originalActivity.id}`,
        {
            credentials: 'same-origin',
        },
    )
    expect(onUpdate).toHaveBeenCalledTimes(1)

    fireEvent.click(
        within(dialog).getByRole('button', {
            name: 'Discard my changes and use latest version',
        }),
    )
    expect(titleInput.value).toBe(latestActivity.title)
    expect(within(dialog).queryByRole('alert')).toBeNull()
    expect(saveButton.hasAttribute('disabled')).toBe(false)
    expect(onUpdate).toHaveBeenCalledTimes(1)

    fireEvent.change(titleInput, { target: { value: savedActivity.title } })
    fireEvent.click(saveButton)
    await screen.findByRole('heading', { name: savedActivity.title, level: 4 })
    expect(onUpdate).toHaveBeenNthCalledWith(2, {
        expectedVersion: latestActivity.version,
        itineraryDayId: latestActivity.itineraryDayId,
        title: savedActivity.title,
        startTime: latestActivity.startTime,
        endTime: latestActivity.endTime,
        location: latestActivity.location,
        description: latestActivity.description,
    })
    expect(screen.queryByRole('dialog')).toBeNull()
})

// Cancel without a request, then confirm deletion and remove the activity.
it('deletes an activity only after confirmation', async () => {
    const activity = makeActivity()
    const fakeFetch = mockActivityRequests({ activities: [activity] })
    render(<TripItinerarySection tripId={tripId} days={days} />)

    await screen.findByRole('heading', { name: activity.title, level: 4 })
    fireEvent.click(
        within(getDay(1)).getByRole('button', { name: 'Delete activity' }),
    )
    let dialog = screen.getByRole('dialog', { name: 'Delete this activity?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(
        within(getDay(1)).getByRole('heading', { name: activity.title }),
    ).not.toBeNull()
    expect(fakeFetch).not.toHaveBeenCalledWith(
        `${activitiesPath}/${activity.id}`,
        expect.objectContaining({ method: 'DELETE' }),
    )

    fireEvent.click(
        within(getDay(1)).getByRole('button', { name: 'Delete activity' }),
    )
    dialog = screen.getByRole('dialog', { name: 'Delete this activity?' })
    fireEvent.click(
        within(dialog).getByRole('button', { name: 'Delete activity' }),
    )

    await waitFor(() => {
        expect(
            within(getDay(1)).queryByRole('heading', { name: activity.title }),
        ).toBeNull()
    })
    expect(fakeFetch).toHaveBeenCalledWith(`${activitiesPath}/${activity.id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(
        within(getDay(1)).getByRole('heading', { name: 'No activities yet.' }),
    ).not.toBeNull()
})
