import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from './App'

describe('Checkin System React Frontend', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders application brand title and status badges', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
      if (url.includes('/status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            status: 'online',
            framework: 'Laravel 12.0',
            php_version: '8.2.12',
            database: { connected: true, connection: 'mysql', database_name: 'checkin_db' },
          }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })
    }))

    render(<App />)

    expect(screen.getByText('Checkin System')).toBeInTheDocument()
    expect(screen.getByText('Laravel 12 API + React 19 Frontend + MySQL Database')).toBeInTheDocument()
    expect(screen.getByText('New Check-In')).toBeInTheDocument()
    expect(screen.getByText('Recent Check-Ins')).toBeInTheDocument()
  })

  it('allows user to type into form and submit check-in', async () => {
    const mockPost = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: 'success',
        data: { id: 2, name: 'John Doe', email: 'john@example.com', note: 'Visiting', status: 'checked_in' },
      }),
    })

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url, options) => {
      if (options?.method === 'POST') {
        return mockPost()
      }
      if (url.includes('/status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            status: 'online',
            framework: 'Laravel 12.0',
            php_version: '8.2.12',
            database: { connected: true, connection: 'mysql', database_name: 'checkin_db' },
          }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: [
            { id: 1, name: 'Alice Smith', email: 'alice@example.com', note: 'Project sync', status: 'checked_in' },
          ],
        }),
      })
    }))

    render(<App />)

    // Verify existing item appears
    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument()
      expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    })

    // Fill form
    const nameInput = screen.getByLabelText(/Full Name/i)
    const emailInput = screen.getByLabelText(/Email Address/i)
    const noteInput = screen.getByLabelText(/Note/i)
    const submitBtn = screen.getByRole('button', { name: /Check In Now/i })

    fireEvent.change(nameInput, { target: { value: 'John Doe' } })
    fireEvent.change(emailInput, { target: { value: 'john@example.com' } })
    fireEvent.change(noteInput, { target: { value: 'Visiting' } })

    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalled()
    })
  })

  it('renders check-in list with delete buttons', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
      if (url.includes('/checkins')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [
              { id: 42, name: 'Sarah Connor', email: 'sarah@resistance.com', note: 'Lead discussion', status: 'checked_in' },
            ],
          }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'online' }),
      })
    }))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Sarah Connor')).toBeInTheDocument()
      expect(screen.getByText('sarah@resistance.com')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Delete check-in for Sarah Connor/i })).toBeInTheDocument()
    })
  })
})
