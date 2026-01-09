# TDD Workflow for Reservation System

## 🚥 Red-Green-Refactor Cycle

### Phase 1: RED - Write Failing Test
1. Write a test that describes the desired behavior
2. Test should fail for the right reason
3. One test case at a time

### Phase 2: GREEN - Make Test Pass
1. Write MINIMAL code to pass the test
2. Hard-code values if needed
3. Don't worry about elegance yet

### Phase 3: REFACTOR - Improve Code
1. Clean up while keeping tests green
2. Remove duplication
3. Apply clean code principles

## Test Structure (AAA Pattern)

```typescript
test('descriptive test name explaining behavior', () => {
  // Arrange - Set up test data and conditions
  const input = ...;

  // Act - Execute the behavior being tested
  const result = functionUnderTest(input);

  // Assert - Verify the expected outcome
  expect(result).toBe(expected);
});
```

## Scripts Available

```bash
npm test                # Run all tests
npm run test:ui         # Run tests with UI
npm run lint            # Check code quality
npm run lint:fix        # Fix auto-fixable issues
npm run format          # Format code
npm run typecheck       # Check TypeScript types
npm run build           # Build the project
```

## Workflow Example

1. **Write test first** (RED)
```typescript
test('should create a reservation with valid data', () => {
  const reservation = createReservation({
    userId: '123',
    date: '2026-01-10',
    time: '14:00',
    guests: 2
  });

  expect(reservation).toBeDefined();
  expect(reservation.status).toBe('confirmed');
});
```

2. **Make it pass** (GREEN)
```typescript
function createReservation(data: ReservationInput): Reservation {
  return {
    id: generateId(),
    ...data,
    status: 'confirmed'
  };
}
```

3. **Refactor** (REFACTOR)
```typescript
// Extract validation
// Improve naming
// Remove duplication
```

4. **Run all tests** to ensure nothing broke

## Rules

- ❌ NEVER write production code before a failing test
- ✅ ALWAYS run tests after each change
- ✅ Keep tests focused and simple
- ✅ Test behavior, not implementation
- ✅ Aim for >80% code coverage

## Next Steps

1. Identify smallest testable feature
2. Write failing test
3. Implement minimal code
4. Refactor
5. Repeat
