import { test, expect } from '@playwright/test'

const validationError = {
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid request input',
    details: {},
  },
}

test.describe('Global HTTP validation', () => {
  test('rejects an invalid registration email', async ({ request }) => {
    const response = await request.post('/api/auth/register', {
      data: {
        email: 'wrong-email',
        username: 'alice',
        password: 'example-password',
      },
    })

    expect(response.status()).toBe(400)
    expect(await response.json()).toEqual(validationError)
  })

  test('rejects unexpected registration fields', async ({ request }) => {
    const response = await request.post('/api/auth/register', {
      data: {
        email: 'validation41@example.com',
        username: 'validation41',
        password: 'example-password',
        role: 'OWNER',
      },
    })

    expect(response.status()).toBe(400)
    expect(await response.json()).toEqual(validationError)
  })

  test('rejects an invalid login email', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: {
        email: 'wrong-email',
        password: 'example-password',
      },
    })

    expect(response.status()).toBe(400)
    expect(await response.json()).toEqual(validationError)
  })
})
