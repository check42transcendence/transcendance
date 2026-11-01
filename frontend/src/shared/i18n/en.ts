// English messages used by the frontend.
// Group keys by scope: common.*, auth.shared.*, or the feature and page.
export const en = {
    // Application name and tagline.
    'app.name': 'Travel Planner',
    'app.tagline': 'Plan your next trip together.',

    // Common messages that any page can reuse.
    'common.actions.retry': 'Retry',
    'common.actions.close': 'Close',
    'common.actions.cancel': 'Cancel',

    // Labels, placeholders, and actions shared by authentication pages.
    'auth.shared.fields.email': 'Email',
    'auth.shared.fields.password': 'Password',
    'auth.shared.placeholders.email': 'you@example.com',
    'auth.shared.actions.signIn': 'Sign in',
    'auth.shared.actions.createAccount': 'Create account',
    'auth.shared.validation.passwordTooShort':
        'Password must contain at least 8 characters.',
    'auth.shared.validation.passwordTooLong':
        'Password must not exceed 72 UTF-8 bytes.',

    // Login page text, validation, and fallback error.
    'auth.login.title': 'Welcome back',
    'auth.login.description': 'Sign in to continue to your trips.',
    'auth.login.placeholders.password': 'Enter your password',
    'auth.login.noAccount': "Don't have an account?",
    'auth.login.validation.required': 'Please enter your email and password.',
    'auth.login.error': 'Unable to sign in. Please try again.',

    // Registration page text, validation, and result messages.
    'auth.register.title': 'Create your account',
    'auth.register.description':
        'Sign up to start planning trips with friends.',
    'auth.register.fields.username': 'Username',
    'auth.register.fields.confirmPassword': 'Confirm password',
    'auth.register.placeholders.username': 'Choose a username',
    'auth.register.placeholders.password': 'Create a password',
    'auth.register.placeholders.confirmPassword': 'Enter your password again',
    'auth.register.hasAccount': 'Already have an account?',
    'auth.register.validation.required': 'Please complete all fields.',
    'auth.register.validation.passwordMismatch': 'Passwords do not match.',
    'auth.register.success': 'Account created. Please sign in.',
    'auth.register.error': 'Unable to create an account. Please try again.',

    // Session checking and signed-in status.
    'auth.session.checking': 'Checking session...',
    'auth.session.signedIn': 'Signed in',
    'auth.session.error': 'Unable to check your session. Please try again.',

    // Logout action, progress, and fallback error.
    'auth.logout.action': 'Sign out',
    'auth.logout.pending': 'Signing out...',
    'auth.logout.error': 'Unable to sign out. Please try again.',

    // Not-found page text and navigation.
    'notFound.title': 'Page not found',
    'notFound.description': 'The page you requested does not exist.',
    'notFound.actions.goToLogin': 'Go to login',

    // Home page text
    'trips.home.error': 'Unable to load your trips. Please try again.',
    'trips.home.title': 'My trips',
    'trips.home.loading': 'Loading your trips...',
    'trips.home.empty.title': 'No trips yet',
    'trips.home.empty.description': 'Create a trip to start planning together.',

    // Membership roles shared by trip pages.
    'trips.shared.roles.owner': 'Owner',
    'trips.shared.roles.member': 'Member',

    // Actions shared by trip pages.
    'trips.shared.actions.create': 'Create trip',

    // Field labels shared by trip pages.
    'trips.shared.fields.title': 'Trip title',
    'trips.shared.fields.destination': 'Trip destination',
    'trips.shared.fields.startDate': 'Start date',
    'trips.shared.fields.endDate': 'End date',
    'trips.shared.fields.description': 'Description (optional)',

    // Create Trip page messages.
    'trips.create.title': 'Create trip',
    'trips.create.validation.required': 'Please complete all required fields.',
    'trips.create.validation.dateRange':
        'End date must not be earlier than start date.',
    'trips.create.validation.duration': 'A trip must not exceed 365 days.',

    'trips.create.pending': 'Creating trip...',
    'trips.create.error': 'Unable to create the trip. Please try again.',

    // Trip workspace page messages.
    'trips.workspace.title': 'Trip workspace',
}
