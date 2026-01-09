# Example Ralph Prompt

Build a reservation system with the following requirements:

## Phase 1: Data Models
- [ ] Create User model (id, name, email, phone)
- [ ] Create Reservation model (id, userId, date, time, guests, status)
- [ ] Add proper TypeScript types

## Phase 2: API Endpoints
- [ ] POST /api/reservations - Create reservation
- [ ] GET /api/reservations/:id - Get reservation
- [ ] GET /api/reservations - List all reservations
- [ ] PUT /api/reservations/:id - Update reservation
- [ ] DELETE /api/reservations/:id - Cancel reservation

## Phase 3: Validation & Tests
- [ ] Add input validation (date, time, guests count)
- [ ] Write unit tests for all endpoints
- [ ] Ensure test coverage > 80%

## Completion Criteria

When ALL of the following are true, output: <promise>COMPLETE</promise>

- All endpoints implemented
- All validations working
- All tests passing
- Test coverage > 80%
- Code follows clean code principles

## Self-Correction Instructions

On each iteration:
1. Run tests
2. If any fail, analyze the error
3. Fix the issue
4. Commit the fix
5. Run tests again
6. Repeat until all pass

If stuck after 15 iterations:
- Document the blocker
- List what was attempted
- Suggest alternative approaches
