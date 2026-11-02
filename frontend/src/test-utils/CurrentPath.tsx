import { useLocation } from 'react-router'

// Exposes the current route path for tests.
export function CurrentPath() {
    const location = useLocation()

    return <output aria-label="Current path">{location.pathname}</output>
}
