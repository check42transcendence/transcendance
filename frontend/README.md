# TripCollab Frontend

React + TypeScript + Vite, with Tailwind CSS v4, Inter, and Lucide icons.

## Development

Use the Node.js version in the repository's `.nvmrc`. From `frontend/`
in your development environment (the Ubuntu development container if used):

```bash
cd ../shared
npm ci
npm run build
cd ../frontend
npm ci
npm run dev
```

Rebuild `shared` after pulling or editing shared types.

Open `http://localhost:5173`. Vite updates the page when source files change.
The `/api` proxy defaults to `http://127.0.0.1:3000`; set `API_PROXY_TARGET`
to use another backend address. The running app checks the session on startup
and requires a reachable backend.
For real Auth testing, use the Docker/HTTPS setup in the
[project README](../README.md), as authentication cookies are Secure.

Use `npm run format` to format frontend files with Prettier, or
`npm run format:check` to check formatting without changing files.
To format only selected files, run `npx prettier --write <file-paths>` from
`frontend/`. ESLint checks code rules; Prettier handles formatting.

Before submitting changes:

```bash
npm test
npm run lint
npm run build
```

## Routing

`main.tsx` provides one `BrowserRouter`; routes are defined in `App.tsx`.

- `/` redirects to `/login`.
- `/login` and `/register` show the Auth pages.
- `/home` shows the current user's trips and a sign-out button.
- `/trips/new` shows the trip creation form.
- `/trips/:tripId` shows Trip details, membership role, Days, and Owner-only deletion.
- These three routes require sign-in; unauthenticated users are redirected to `/login`.
- Unknown paths show the not-found page.

Use React Router navigation instead of local state to switch pages.

## Trips

Home loads member-scoped trips and shows loading, error, and empty states.
Select a trip title to open its Workspace path, or choose Create trip.

Creation requires a title, destination, and dates; description is optional.
Dates must be ordered and span at most 365 days, including both endpoints.
Successful creation opens the new Workspace path. Failed requests preserve
input for retry; Cancel returns home without submitting.

Workspace loads details and Days from its URL, including on refresh. Trip fields
are read-only. Missing or inaccessible trips show the same message. Owners can
confirm deletion; success returns home and reloads the list, while failure keeps
the confirmation open with an error.

## Authentication

`src/api/auth.ts` provides `register`, `login`, `getMe`, and `logout` using
the shared API client. `App.tsx` manages user state, loading, errors, and navigation.

- Registration shows a success message; it does not log the user in.
- Login saves the returned user in React state and opens `/home`.
- On startup or refresh, `getMe()` restores the user from the backend session.
  A `401` means unauthenticated; other failures show an error with a retry button.
- Logout clears the backend cookie and local user state, then returns to `/login`.
  If logout fails, the current user is preserved and an error is shown.

`npm test` runs API and page tests with mocked requests; no backend is required.

Frontend tests are grouped by responsibility:

- `src/App.test.tsx`: routing, session restoration, and logout.
- `src/pages/*.test.tsx`: Auth flows through App, Home, trip creation, and Workspace
  loading, access errors, and deletion interactions.
- `src/api/auth.test.ts`: Auth API requests and responses.
- `src/lib/http/api-client.test.ts`: shared HTTP behavior.
- `src/test-utils/`: shared test setup and route inspection helpers.

Playwright tests verify the real Auth and Trip lifecycle flows using a separate
Docker stack and database. See the [E2E guide](../e2e/README.md) for running them.

## HTTP Utilities

Keep these responsibilities separate:

- `shared/src/api/*.types.ts` (repository root): API types used by frontend and backend.
- `frontend/src/api/`: feature-specific requests such as `getTrips()` and `login()`.
- `frontend/src/lib/http/`: reusable frontend request and error-handling utilities.

Use the helpers in `src/lib/http/api-client.ts`:

| Helper                       | Use                                                        |
| ---------------------------- | ---------------------------------------------------------- |
| `apiClient(path, options?)`  | Returns the raw response, including empty `204` responses. |
| `apiJson<T>(path, options?)` | Reads a JSON response.                                     |
| `apiPostJson<T>(path, data)` | Sends JSON with POST and reads a JSON response.            |

Pass paths such as `/auth/me`; the client adds `/api` and uses same-origin
cookie credentials. Type `T` describes the expected data without runtime validation.

HTTP failures throw `ApiError` with `code`, `message`, `status`, and optional
`details`. Unreadable error responses use `HTTP_ERROR`. Pages handle loading,
error messages, and navigation.

Run `npm test` to check the client with mocked requests; no backend is required.

## Translation Keys

Keep frontend UI text in `src/shared/i18n/en.ts` and read it with `t()`.
English is the only current language; language switching is not included.

```tsx
import { t } from '../shared/i18n/translation'

;<h1>{t('auth.login.title')}</h1>
```

Adjust the import path for your file. Add new keys under the matching comment
in `en.ts`:

- `app.*`: product name and tagline.
- `common.*`: messages shared across the application.
- `auth.shared.*`: labels and actions shared by Auth pages.
- `auth.login.*` / `auth.register.*`: page-specific messages.
- `auth.session.*` / `auth.logout.*`: session and logout messages.
- `notFound.*`: not-found page messages.
- `trips.shared.*`: labels and actions shared by Trip pages.
- `trips.home.*` / `trips.create.*` / `trips.workspace.*`: Trip page messages.

Follow the same pattern for new features. Reuse keys when their meaning is the
same. Backend error messages and the default HTTP error remain in English.

## Shared Layout

Layout components live in `src/components/layout/`:

- `PageContainer`: a centered `<main>` with shared padding. Defaults to
  `size="wide"` (maximum 1152px) for content pages. Use `size="compact"`
  (maximum 440px) for forms, as in Login, Register, and Create Trip.
  Use `className` for extra spacing.
- `AuthHeader`: the product name and tagline shared by login and registration.

Example from a page in `src/pages/`:

```tsx
import { PageContainer } from '../components/layout/PageContainer'
import { AuthHeader } from '../components/layout/AuthHeader'

;<PageContainer size="compact" className="space-y-4">
    <AuthHeader />
    {/* Page content goes here. */}
</PageContainer>
```

`PageContainer` already provides `<main>`; do not nest another `<main>` inside it.

## Shared UI Components

Components live in `src/components/ui/`. Button, Input, Textarea, Select,
Card, and Badge accept native HTML attributes. EmptyState, Modal, Tabs,
and Toast use the explicit props below.

| Component    | Props and behavior                                                                                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Button`     | `variant`: `primary` (default), `secondary`, or `danger`; `isLoading` disables interaction and shows a centered spinner while preserving button dimensions and its accessible name. `disabled` uses the shared disabled colors. Defaults to `type="button"`. |
| `Input`      | Required `label`, optional `error`; supports `value`/`onChange`, `disabled`, and `readOnly`. Associates labels and error messages with the input.                                                                                                            |
| `Textarea`   | Required `label`, optional `error`; defaults to 4 rows and disables manual resizing. Supports `value`/`onChange`, `disabled`, and `readOnly`, with labels and errors associated with the control.                                                            |
| `Select`     | Required `label`, optional `error`; accepts native `<option>` children, `value`/`onChange`, and `disabled`. Uses the browser's dropdown and keyboard behavior; no `readOnly` support.                                                                        |
| `Card`       | A non-interactive container with shared padding, border, radius, and shadow. Place content and action controls inside it.                                                                                                                                    |
| `Badge`      | Non-interactive label. `variant`: `neutral` (default), `success`, `warning`, `danger`, or `info`. Pass the label as children; pages choose the variant.                                                                                                      |
| `EmptyState` | Required `title`; optional `description`, `action` (React content), and `className`. Displays a centered empty-content message.                                                                                                                              |
| `Modal`      | `open`, `onClose`, `title`, and `children`; optional `footer`. Uses a native dialog with a close button and Escape support.                                                                                                                                  |
| `Tabs`       | `label`, `items`, `value`, and `onValueChange`. Each item has `value`, `label`, and `content`. Supports mouse selection and left/right arrow keys.                                                                                                           |
| `Toast`      | `open`, `message`, and `onClose`; optional `variant`: `info` (default), `success`, `warning`, or `danger`. Optional `autoCloseMs` enables timed dismissal; omitted or `0` means manual close.                                                                |

```tsx
import { useState } from 'react'
import { Button } from './components/ui/Button'
import { Card } from './components/ui/Card'
import { Input } from './components/ui/Input'

export function Example() {
    const [email, setEmail] = useState('')

    return (
        <Card className="space-y-4">
            <Input
                label="Email"
                type="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
            />
            <Button variant="secondary" disabled={!email.trim()}>
                Example action
            </Button>
        </Card>
    )
}
```

The example demonstrates composition; it does not submit data. Pages own
request state, validation, error text, and confirmation for dangerous actions.
Use separate state variables for independent controlled inputs.

Buttons accept icons through `children`, for example a Lucide icon followed
by text. Use `size={20}`, `strokeWidth={2}`, and `aria-hidden="true"` for
decorative icons. Icon-only buttons need an accessible name (`aria-label`).

Input hover keeps the default white background; focus and errors provide
feedback. Card has no built-in hover effect or whole-card click action.

### Form control examples

Import `Textarea` and `Select` from `src/components/ui/`:

```tsx
<Textarea label="Description" name="description" maxLength={500} />

<Select label="Transport" name="transport" defaultValue="" required>
  <option value="" disabled>Choose transport</option>
  <option value="train">Train</option>
  <option value="bus">Bus</option>
</Select>
```

The disabled initial option acts as a muted prompt. Pages supply validation
messages through `error`; components do not perform business validation.

### Display component examples

Import `Badge` and `EmptyState` from `src/components/ui/`:

```tsx
<Badge variant="success">Accepted</Badge>

<EmptyState
  title="No trips yet"
  description="Create your first trip to get started."
  action={<Button onClick={handleCreateTrip}>Create trip</Button>}
/>
```

Pages provide translated text, choose status variants, and implement actions
such as `handleCreateTrip`. These components do not fetch data or run business logic.

### Interactive components

Pages own Modal and Toast visibility and the selected Tabs value. An `onClose`
handler should set the matching `open` state to `false`.

- Modal uses the browser's modal focus behavior. Clicking the backdrop does not close it.
- Tabs items need unique values; the selected `value` must match an item.
- Keep Toast mounted and change its `open` prop so its announcement region remains
  available. One Toast shows one message; it does not queue notifications.
  `autoCloseMs={5000}` closes it after five seconds. Changing the message restarts
  the timer. Leave important messages open for manual dismissal.

### Local UI preview

Run `npm run dev` and open `http://localhost:5173/ui.html` to preview components
without a backend or session check. Edit `src/dev/UiPreview.tsx` to add examples.
This is a Vite development entry; the current production build uses `index.html`.

## Styling

Design values and Tailwind mappings live in
`src/styles/tripcollab.tokens.css`; `src/index.css` loads them and defines
base styles and the shared keyboard focus class, `tc-focus`.

Reuse semantic classes such as `bg-brand`, `rounded-control`, and
`text-muted`. Component classes are grouped into named constants with
English comments. Use `className` for layout additions such as margins or
width; do not rely on class-string order to override component colors or states.
