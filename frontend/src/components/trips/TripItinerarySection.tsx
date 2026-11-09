import { useEffect, useState, useId } from 'react'
import type { Activity, ItineraryDay } from '@tripcollab/shared'
import {
    getActivities,
    createActivity,
    deleteActivity,
    updateActivity,
    getActivity,
} from '../../api/activities'
import { ApiError } from '../../lib/http/api-error'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { EmptyState } from '../ui/EmptyState'
import { Select } from '../ui/Select'
import { t } from '../../shared/i18n/translation'

type TripItinerarySectionProps = {
    tripId: string
    days: ItineraryDay[]
}

// Display the trip's fixed itinerary days and their activities.
export function TripItinerarySection({
    tripId,
    days,
}: TripItinerarySectionProps) {
    const createFormId = useId()
    const editFormId = useId()

    const [activities, setActivities] = useState<Activity[]>([])
    const [activitiesLoading, setActivitiesLoading] = useState(true)
    const [activitiesError, setActivitiesError] = useState('')

    // Keep the create form separate from saved activities.
    const [createDay, setCreateDay] = useState<ItineraryDay | null>(null)
    const [createTitle, setCreateTitle] = useState('')
    const [createStartTime, setCreateStartTime] = useState('')
    const [createEndTime, setCreateEndTime] = useState('')
    const [createLocation, setCreateLocation] = useState('')
    const [createDescription, setCreateDescription] = useState('')
    const [createLoading, setCreateLoading] = useState(false)
    const [createValidationError, setCreateValidationError] = useState('')
    const [createError, setCreateError] = useState('')

    const [deleteTarget, setDeleteTarget] = useState<Activity | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [deleteError, setDeleteError] = useState('')

    // Keep the original version alongside editable draft fields.
    const [editTarget, setEditTarget] = useState<Activity | null>(null)
    const [editDayId, setEditDayId] = useState('')
    const [editTitle, setEditTitle] = useState('')
    const [editStartTime, setEditStartTime] = useState('')
    const [editEndTime, setEditEndTime] = useState('')
    const [editLocation, setEditLocation] = useState('')
    const [editDescription, setEditDescription] = useState('')
    const [editLoading, setEditLoading] = useState(false)
    const [editValidationError, setEditValidationError] = useState('')
    const [editError, setEditError] = useState('')

    // Keep the latest saved activity separate from the user's draft.
    const [editConflict, setEditConflict] = useState(false)
    const [latestActivity, setLatestActivity] = useState<Activity | null>(null)
    const [latestLoading, setLatestLoading] = useState(false)
    const [latestError, setLatestError] = useState('')

    // Reload activities when the trip changes and ignore outdated results.
    useEffect(() => {
        let active = true

        async function loadActivities(): Promise<void> {
            setActivitiesLoading(true)
            setActivitiesError('')
            setActivities([])

            try {
                const activitiesResult = await getActivities(tripId)
                if (active) {
                    setActivities(activitiesResult.activities)
                }
            } catch {
                if (active) {
                    setActivitiesError(t('activities.error'))
                }
            } finally {
                if (active) {
                    setActivitiesLoading(false)
                }
            }
        }

        void loadActivities()

        return () => {
            active = false
        }
    }, [tripId])

    // Start a fresh activity form for the selected day.
    function openCreateDialog(day: ItineraryDay): void {
        setCreateValidationError('')
        setCreateError('')
        setCreateTitle('')
        setCreateStartTime('')
        setCreateEndTime('')
        setCreateLocation('')
        setCreateDescription('')
        setCreateDay(day)
    }

    // Validate the form and add the activity returned by the backend.
    async function handleCreateActivity(): Promise<void> {
        if (!createDay || createLoading) return

        const title = createTitle.trim()

        setCreateValidationError('')
        setCreateError('')

        if (!title || !createStartTime) {
            setCreateValidationError(t('activities.validation.required'))
            return
        }

        if (createEndTime && createEndTime < createStartTime) {
            setCreateValidationError(t('activities.validation.timeRange'))
            return
        }

        setCreateLoading(true)

        try {
            const createResult = await createActivity(tripId, {
                itineraryDayId: createDay.id,
                title: title,
                startTime: createStartTime,
                endTime: createEndTime || null,
                location: createLocation.trim() || null,
                description: createDescription.trim() || null,
            })

            setActivities((previous) => [...previous, createResult.activity])
            setCreateDay(null)
        } catch {
            setCreateError(t('activities.create.error'))
        } finally {
            setCreateLoading(false)
        }
    }

    // Keep the form open while saving and clear feedback after closing.
    function closeCreateDialog(): void {
        if (createLoading) return

        setCreateDay(null)
        setCreateValidationError('')
        setCreateError('')
    }

    // Remove the activity only after the backend confirms deletion.
    async function handleDeleteActivity(): Promise<void> {
        if (!deleteTarget || deleteLoading) return

        setDeleteLoading(true)
        setDeleteError('')

        try {
            const deleteResult = await deleteActivity(
                tripId,
                deleteTarget.id,
            )

            setActivities((previous) =>
                previous.filter(
                    (activity) =>
                        activity.id !== deleteResult.deletedActivityId,
                ),
            )
            // Proposal UI integration will handle reopenedProposalId refreshes.
            setDeleteTarget(null)
        } catch {
            setDeleteError(t('activities.delete.error'))
        } finally {
            setDeleteLoading(false)
        }
    }

    // Keep the confirmation open while deleting.
    function closeDeleteDialog(): void {
        if (deleteLoading) return

        setDeleteTarget(null)
        setDeleteError('')
    }

    // Start editing with the selected activity's saved values.
    function openEditDialog(activity: Activity): void {
        setEditConflict(false)
        setLatestActivity(null)
        setLatestError('')
        setEditValidationError('')
        setEditError('')
        setEditDayId(activity.itineraryDayId)
        setEditTitle(activity.title)
        setEditStartTime(activity.startTime)
        setEditEndTime(activity.endTime ?? '')
        setEditLocation(activity.location ?? '')
        setEditDescription(activity.description ?? '')
        setEditTarget(activity)
    }

    // Save the draft using the version captured when editing began.
    async function handleUpdateActivity(): Promise<void> {
        if (
            !editTarget ||
            !editDayId ||
            editLoading ||
            latestLoading ||
            editConflict
        ) {
            return
        }

        const title = editTitle.trim()

        setEditValidationError('')
        setEditError('')

        if (!title || !editStartTime) {
            setEditValidationError(t('activities.validation.required'))
            return
        }

        if (editEndTime && editEndTime < editStartTime) {
            setEditValidationError(t('activities.validation.timeRange'))
            return
        }

        setEditLoading(true)

        try {
            const editResult = await updateActivity(tripId, editTarget.id, {
                expectedVersion: editTarget.version,
                itineraryDayId: editDayId,
                title: title,
                startTime: editStartTime,
                endTime: editEndTime || null,
                location: editLocation.trim() || null,
                description: editDescription.trim() || null,
            })

            setActivities((previous) =>
                previous.map((activity) =>
                    activity.id === editResult.activity.id
                        ? editResult.activity
                        : activity,
                ),
            )
            setEditTarget(null)
        } catch (error) {
            // Keep the draft and require conflict resolution before saving again.
            if (
                error instanceof ApiError &&
                error.code === 'ACTIVITY_VERSION_CONFLICT'
            ) {
                setEditConflict(true)
                setEditError(t('activities.edit.conflict'))
            } else {
                setEditError(t('activities.edit.error'))
            }
        } finally {
            setEditLoading(false)
        }
    }

    // Fetch the latest saved activity without changing the draft.
    async function handleLoadLatestActivity(): Promise<void> {
        if (!editTarget || latestLoading) return

        setLatestLoading(true)
        setLatestError('')

        try {
            const latestResult = await getActivity(tripId, editTarget.id)
            setLatestActivity(latestResult.activity)
        } catch {
            setLatestError(t('activities.edit.latestError'))
        } finally {
            setLatestLoading(false)
        }
    }

    // Discard the draft only when the user chooses the latest version.
    function handleUseLatestActivity(): void {
        if (!latestActivity || editLoading || latestLoading) return

        openEditDialog(latestActivity)
    }

    // Prevent closing during save or reload, and clear feedback on close.
    function closeEditDialog(): void {
        if (editLoading || latestLoading) return

        setEditTarget(null)
        setEditValidationError('')
        setEditError('')
    }

    return (
        <section className="mt-6">
            <h2 className="text-card-title font-medium">
                {t('trips.workspace.days.title')}
            </h2>

            {activitiesLoading && (
                <p role="status">{t('activities.loading')}</p>
            )}

            {!activitiesLoading && activitiesError && (
                <p role="alert">{activitiesError}</p>
            )}

            <ol className="mt-3 space-y-3">
                {days.map((day) => {
                    // Sort within each day; IDs break ties between equal start times.
                    const dayActivities = activities
                        .filter(
                            (activity) => activity.itineraryDayId === day.id,
                        )
                        .sort(
                            (a, b) =>
                                a.startTime.localeCompare(b.startTime) ||
                                a.id.localeCompare(b.id),
                        )

                    return (
                        <li key={day.id}>
                            <Card className="space-y-3">
                                <h3 className="text-card-title font-medium">
                                    {t('trips.workspace.days.day')}{' '}
                                    {day.dayNumber}
                                </h3>
                                <p className="text-muted">{day.date}</p>

                                <Button
                                    type="button"
                                    onClick={() => openCreateDialog(day)}
                                >
                                    {t('activities.actions.create')}
                                </Button>

                                {!activitiesLoading &&
                                    !activitiesError &&
                                    dayActivities.length === 0 && (
                                        <EmptyState title={t('activities.empty')} />
                                    )}

                                {!activitiesLoading && !activitiesError && (
                                    <ul className="space-y-3">
                                        {dayActivities.map((activity) => (
                                            <li key={activity.id}>
                                                <Card className="space-y-3">
                                                    <h4 className="font-medium wrap-break-word">
                                                        {activity.title}
                                                    </h4>
                                                    <p>
                                                        {activity.startTime}
                                                        {activity.endTime &&
                                                            ` - ${activity.endTime}`}
                                                    </p>

                                                    {activity.location && (
                                                        <p className="wrap-break-word">
                                                            {activity.location}
                                                        </p>
                                                    )}

                                                    {activity.description && (
                                                        <p className="whitespace-pre-wrap wrap-break-word">
                                                            {activity.description}
                                                        </p>
                                                    )}

                                                    <div className="text-small text-muted wrap-break-word">
                                                        <p>
                                                            {t('activities.createdBy')}:{' '}
                                                            {activity.createdBy.username}
                                                        </p>

                                                        <p>
                                                            {t('activities.updatedBy')}:{' '}
                                                            {activity.updatedBy.username}
                                                        </p>
                                                    </div>

                                                    <div className="flex flex-wrap gap-3 pt-1">
                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            onClick={() =>
                                                                openEditDialog(activity)}
                                                        >
                                                            {t('activities.actions.edit')}
                                                        </Button>

                                                        <Button
                                                            type="button"
                                                            variant="danger"
                                                            onClick={() =>
                                                                setDeleteTarget(activity)
                                                            }
                                                        >
                                                            {t('activities.actions.delete')}
                                                        </Button>
                                                    </div>
                                                </Card>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Card>
                        </li>
                    )
                })}
            </ol>
            <Modal
                open={createDay !== null}
                onClose={closeCreateDialog}
                title={t('activities.actions.create')}
                footer={
                    <>
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={createLoading}
                            onClick={closeCreateDialog}
                        >
                            {t('common.actions.cancel')}
                        </Button>

                        <Button
                            type="submit"
                            form={createFormId}
                            isLoading={createLoading}
                        >
                            {t('activities.actions.create')}
                        </Button>
                    </>
                }
            >
                {createDay && (
                    <p>
                        {t('trips.workspace.days.day')} {createDay.dayNumber}
                        {' · '}
                        {createDay.date}
                    </p>
                )}

                <form
                    id={createFormId}
                    className="mt-4 space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault()
                        void handleCreateActivity()
                    }}
                >
                    <Input
                        label={t('activities.fields.title')}
                        name="title"
                        type="text"
                        value={createTitle}
                        disabled={createLoading}
                        onChange={(event) =>
                            setCreateTitle(event.currentTarget.value)
                        }
                        required
                    />

                    <Input
                        label={t('activities.fields.startTime')}
                        name="startTime"
                        type="time"
                        value={createStartTime}
                        disabled={createLoading}
                        onChange={(event) =>
                            setCreateStartTime(event.currentTarget.value)
                        }
                        required
                    />

                    <Input
                        label={t('activities.fields.endTime')}
                        name="endTime"
                        type="time"
                        value={createEndTime}
                        disabled={createLoading}
                        onChange={(event) =>
                            setCreateEndTime(event.currentTarget.value)
                        }
                    />

                    <Input
                        label={t('activities.fields.location')}
                        name="location"
                        type="text"
                        value={createLocation}
                        disabled={createLoading}
                        onChange={(event) =>
                            setCreateLocation(event.currentTarget.value)
                        }
                    />

                    <Textarea
                        label={t('activities.fields.description')}
                        name="description"
                        value={createDescription}
                        disabled={createLoading}
                        onChange={(event) =>
                            setCreateDescription(event.currentTarget.value)
                        }
                    />

                    {createValidationError && (
                        <p role="alert" className="text-danger">
                            {createValidationError}
                        </p>
                    )}

                    {createError && (
                        <p role="alert" className="text-danger">
                            {createError}
                        </p>
                    )}
                </form>
            </Modal>

            <Modal
                open={deleteTarget !== null}
                onClose={closeDeleteDialog}
                title={t('activities.delete.title')}
                footer={
                    <>
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={deleteLoading}
                            onClick={closeDeleteDialog}
                        >
                            {t('common.actions.cancel')}
                        </Button>

                        <Button
                            type="button"
                            variant="danger"
                            isLoading={deleteLoading}
                            onClick={handleDeleteActivity}
                        >
                            {t('activities.actions.delete')}
                        </Button>
                    </>
                }
            >
                <p>{t('activities.delete.description')}</p>

                {deleteTarget && (
                    <p className="mt-3 font-medium wrap-break-word">
                        {deleteTarget.title}
                    </p>
                )}

                {deleteError && (
                    <p role="alert" className="mt-3 text-danger">
                        {deleteError}
                    </p>
                )}
            </Modal>

            <Modal
                open={editTarget !== null}
                onClose={closeEditDialog}
                title={t('activities.actions.edit')}
                footer={
                    <>
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={editLoading || latestLoading}
                            onClick={closeEditDialog}
                        >
                            {t('common.actions.cancel')}
                        </Button>

                        <Button
                            type="submit"
                            form={editFormId}
                            isLoading={editLoading}
                            disabled={editConflict || latestLoading}
                        >
                            {t('activities.actions.save')}
                        </Button>
                    </>
                }
            >
                <form
                    id={editFormId}
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault()
                        void handleUpdateActivity()
                    }}
                >
                    <Select
                        label={t('activities.fields.day')}
                        name="itineraryDayId"
                        value={editDayId}
                        disabled={editLoading}
                        onChange={(event) =>
                            setEditDayId(event.currentTarget.value)
                        }
                        required
                    >
                        {days.map((day) => (
                            <option key={day.id} value={day.id}>
                                {t('trips.workspace.days.day')} {day.dayNumber}
                                {' · '}
                                {day.date}
                            </option>
                        ))}
                    </Select>

                    <Input
                        label={t('activities.fields.title')}
                        name="title"
                        type="text"
                        value={editTitle}
                        disabled={editLoading}
                        onChange={(event) =>
                            setEditTitle(event.currentTarget.value)
                        }
                        required
                    />

                    <Input
                        label={t('activities.fields.startTime')}
                        name="startTime"
                        type="time"
                        value={editStartTime}
                        disabled={editLoading}
                        onChange={(event) =>
                            setEditStartTime(event.currentTarget.value)
                        }
                        required
                    />

                    <Input
                        label={t('activities.fields.endTime')}
                        name="endTime"
                        type="time"
                        value={editEndTime}
                        disabled={editLoading}
                        onChange={(event) =>
                            setEditEndTime(event.currentTarget.value)
                        }
                    />

                    <Input
                        label={t('activities.fields.location')}
                        name="location"
                        type="text"
                        value={editLocation}
                        disabled={editLoading}
                        onChange={(event) =>
                            setEditLocation(event.currentTarget.value)
                        }
                    />

                    <Textarea
                        label={t('activities.fields.description')}
                        name="description"
                        value={editDescription}
                        disabled={editLoading}
                        onChange={(event) =>
                            setEditDescription(event.currentTarget.value)
                        }
                    />

                    {editValidationError && (
                        <p role="alert" className="text-danger">
                            {editValidationError}
                        </p>
                    )}

                    {editError && (
                        <p role="alert" className="text-danger">
                            {editError}
                        </p>
                    )}

                    {editConflict && (
                        <Button
                            type="button"
                            variant="secondary"
                            isLoading={latestLoading}
                            disabled={editLoading}
                            onClick={() => void handleLoadLatestActivity()}
                        >
                            {t('activities.edit.viewLatest')}
                        </Button>
                    )}

                    {latestError && (
                        <p role="alert" className="text-danger">
                            {latestError}
                        </p>
                    )}

                    {/* Show saved values without replacing the editable draft. */}
                    {latestActivity && (
                        <Card className="space-y-3">
                            <h3 className="font-medium">
                                {t('activities.edit.latestLoaded')}
                            </h3>

                            <dl className="space-y-2">
                                <div>
                                    <dt className="text-muted">
                                        {t('activities.fields.day')}
                                    </dt>
                                    <dd>
                                        {days.find(
                                            (day) => day.id === latestActivity.itineraryDayId,
                                        )?.date ?? '—'}
                                    </dd>
                                </div>

                                <div>
                                    <dt className="text-muted">
                                        {t('activities.fields.title')}
                                    </dt>
                                    <dd className="wrap-break-word">
                                        {latestActivity.title}
                                    </dd>
                                </div>

                                <div>
                                    <dt className="text-muted">
                                        {t('activities.fields.startTime')}
                                    </dt>
                                    <dd>{latestActivity.startTime}</dd>
                                </div>

                                <div>
                                    <dt className="text-muted">
                                        {t('activities.fields.endTime')}
                                    </dt>
                                    <dd>{latestActivity.endTime ?? '—'}</dd>
                                </div>

                                <div>
                                    <dt className="text-muted">
                                        {t('activities.fields.location')}
                                    </dt>
                                    <dd className="wrap-break-word">
                                        {latestActivity.location || '—'}
                                    </dd>
                                </div>

                                <div>
                                    <dt className="text-muted">
                                        {t('activities.fields.description')}
                                    </dt>
                                    <dd className="whitespace-pre-wrap wrap-break-word">
                                        {latestActivity.description || '—'}
                                    </dd>
                                </div>
                            </dl>

                            <Button
                                type="button"
                                variant="secondary"
                                disabled={editLoading || latestLoading}
                                onClick={handleUseLatestActivity}
                            >
                                {t('activities.edit.useLatest')}
                            </Button>
                        </Card>
                    )}
                </form>
            </Modal>
        </section >
    )
}
