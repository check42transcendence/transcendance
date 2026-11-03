// English messages grouped by shared scope and page.
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
    'auth.login.validation.required':
        'Please enter your email and password.',
    'auth.login.error': 'Unable to sign in. Please try again.',

    // Registration page text, validation, and result messages.
    'auth.register.title': 'Create your account',
    'auth.register.description':
        'Sign up to start planning trips with friends.',
    'auth.register.fields.username': 'Username',
    'auth.register.fields.confirmPassword': 'Confirm password',
    'auth.register.placeholders.username': 'Choose a username',
    'auth.register.placeholders.password': 'Create a password',
    'auth.register.placeholders.confirmPassword':
        'Enter your password again',
    'auth.register.hasAccount': 'Already have an account?',
    'auth.register.validation.required': 'Please complete all fields.',
    'auth.register.validation.passwordMismatch':
        'Passwords do not match.',
    'auth.register.success': 'Account created. Please sign in.',
    'auth.register.error':
        'Unable to create an account. Please try again.',

    // Session status and logout messages.
    'auth.session.checking': 'Checking session...',
    'auth.session.signedIn': 'Signed in',
    'auth.session.error':
        'Unable to check your session. Please try again.',

    'auth.logout.action': 'Sign out',
    'auth.logout.pending': 'Signing out...',
    'auth.logout.error': 'Unable to sign out. Please try again.',

    // Not-found page text and navigation.
    'notFound.title': 'Page not found',
    'notFound.description': 'The page you requested does not exist.',
    'notFound.actions.goToLogin': 'Go to login',

    // Roles, actions, and field labels shared by trip pages.
    'trips.shared.roles.owner': 'Owner',
    'trips.shared.roles.member': 'Member',
    'trips.shared.actions.create': 'Create trip',
    'trips.shared.actions.backToHome': 'Back to home',
    'trips.shared.fields.title': 'Trip title',
    'trips.shared.fields.destination': 'Trip destination',
    'trips.shared.fields.startDate': 'Start date',
    'trips.shared.fields.endDate': 'End date',
    'trips.shared.fields.description': 'Description (optional)',

    // Home page messages.
    'trips.home.error': 'Unable to load your trips. Please try again.',
    'trips.home.title': 'My trips',
    'trips.home.loading': 'Loading your trips...',
    'trips.home.empty.title': 'No trips yet',
    'trips.home.empty.description':
        'Create a trip to start planning together.',

    // Create Trip page messages.
    'trips.create.title': 'Create trip',
    'trips.create.validation.required':
        'Please complete all required fields.',
    'trips.create.validation.dateRange':
        'End date must not be earlier than start date.',
    'trips.create.validation.duration':
        'A trip must not exceed 365 days.',
    'trips.create.pending': 'Creating trip...',
    'trips.create.error':
        'Unable to create the trip. Please try again.',

    // Trip workspace page messages.
    'trips.workspace.title': 'Trip workspace',
    'trips.workspace.loading': 'Loading trip...',
    'trips.workspace.error':
        'Unable to load the trip. Please try again.',
    'trips.workspace.days.title': 'Itinerary days',
    'trips.workspace.days.day': 'Day',
    'trips.workspace.unavailable':
        'This trip does not exist or you do not have access.',
    'trips.workspace.delete.action': 'Delete trip',
    'trips.workspace.delete.title': 'Delete this trip?',
    'trips.workspace.delete.description':
        'This will permanently delete the trip and its workspace data. This cannot be undone.',
    'trips.workspace.delete.pending': 'Deleting...',
    'trips.workspace.delete.error':
        'Unable to delete the trip. Please try again.',

    // Trip members, invitations, and leave actions.
    'membership.title': 'Members',
    'membership.loading': 'Loading members...',
    'membership.error': 'Unable to load members. Please try again.',
    'membership.empty': 'No members to display.',
    'membership.leave.action': 'Leave trip',
    'membership.leave.title': 'Leave this trip?',
    'membership.leave.description':
        'You will lose access to this trip. An owner must invite you again to rejoin.',
    'membership.leave.error': 'Unable to leave the trip. Please try again.',
    'membership.invite.action': 'Invite member',
    'membership.invite.title': 'Invite a member',
    'membership.invite.description':
        'Invite a registered user by username or email.',
    'membership.invite.method': 'Find user by',
    'membership.invite.byUsername': 'Username',
    'membership.invite.byEmail': 'Email',
    'membership.invite.required': 'Please enter a username or email.',
    'membership.invite.success': 'Invitation sent.',
    'membership.invite.error':
        'Unable to send the invitation. Please try again.',
    'membership.invite.userNotFound':
        'No user found with that username or email.',
    'membership.invite.alreadyPending':
        'This user already has a pending invitation.',
    'membership.invite.alreadyMember':
        'This user is already a trip member.',
}
