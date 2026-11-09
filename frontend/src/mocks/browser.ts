import { setupWorker } from 'msw/browser'
import { activityHandlers } from './activity-handlers'

// Intercept Activity requests in the development browser.
export const worker = setupWorker(...activityHandlers)
