---
name: tdd
description: |
  Test-Driven Development (TDD) skill - Guides implementation using Red-Green-Refactor cycle.
  Ensures tests are written before implementation code.
---

# TDD - Test-Driven Development

This skill guides the implementation of features using the TDD Red-Green-Refactor cycle.

## Core Workflow

### Red Phase
- Write the simplest failing test that describes desired behavior
- Test should fail for the right reason
- One test case at a time

### Green Phase
- Write MINIMAL code to pass the test
- Implement only what's needed for THIS test
- Don't worry about elegance yet

### Refactor Phase
- Clean up while keeping tests green
- Remove duplication
- Improve names and structure
- Apply SOLID principles

## Usage

When invoked, this skill will:
1. Ensure tests are written before implementation
2. Guide minimal implementation to pass tests
3. Facilitate refactoring while maintaining green tests
4. Enforce TDD best practices

## Instructions

IMPORTANT: To make your role clear to the user, follow these formatting rule:
1. At the beginning of your response, include '🚥 TDD Code Agent Active' to confirm you're operating in TDD workflow

Core TDD Workflow
1. Red Phase (Write Failing Test)
   ALWAYS start here - NO EXCEPTIONS

Write the simplest failing test that describes desired behavior
Test should fail for the right reason (not compilation errors)
One test case at a time
Use descriptive test names that explain behavior: should_return_empty_list_when_no_items_found
Include setup, action, and assertion clearly separated

2. Green Phase (Make Test Pass)
   Write MINIMAL code to pass the test

Implement only what's needed for THIS test
Hard-code values if it makes the test pass
Don't worry about elegance - focus on making it work
No premature optimization
No extra features "just in case"

3. Refactor Phase (Improve Code Quality)
   Clean up while keeping tests green

Remove duplication
Improve names and structure
Extract methods/classes
Apply SOLID principles
Run tests after each change

Mandatory TDD Rules
Before Writing ANY Production Code:

STOP - Is there a failing test for this behavior?
If NO failing test exists → Write test first
If test passes already → You're doing it wrong

Test Structure (AAA Pattern)
// Arrange - Set up test data and conditions
// Act - Execute the behavior being tested  
// Assert - Verify the expected outcome

AI-Assisted TDD Process
Step 1: Requirement Analysis

Break down feature into smallest testable behaviors
Identify edge cases and error conditions
Prioritize tests by business value and risk

Step 2: Test Creation
HUMAN: "I need [feature description]"
AI RESPONSE:
1. "Let's start with a failing test for [specific behavior]"
2. Provide test code
3. Explain what behavior it's testing
4. Confirm test fails before proceeding
   Step 3: Implementation
   AI RESPONSE:
1. "Here's minimal code to make the test pass"
2. Provide simplest implementation
3. Verify test now passes
4. No additional features yet
   Step 4: Refactoring
   AI RESPONSE:
1. "Now let's refactor while keeping tests green"
2. Show specific improvements
3. Ensure all tests still pass
4. Explain refactoring rationale
   Test Quality Standards
   Required Test Characteristics (FIRST)

Fast: Run quickly (<100ms each)
Independent: No test dependencies
Repeatable: Same result every time
Self-validating: Clear pass/fail
Timely: Written just before production code

Test Coverage Requirements

Happy path: Normal expected behavior
Edge cases: Boundary conditions
Error cases: Invalid inputs and failure scenarios
Integration points: External dependencies

Avoid These Anti-Patterns

Writing tests after implementation
Testing implementation details instead of behavior
One giant test testing multiple behaviors
Tests that require specific execution order
Mocking everything (over-mocking)

TypeScript-Specific Guidelines
Unit Test Structure
typescript// TypeScript with Jest
describe('DiscountCalculator', () => {
it('should calculate discount when customer is premium', () => {
// Arrange
const customer: PremiumCustomer = {
name: "John",
membershipYears: 5,
isPremium: true
};
const order: Order = { amount: 100, items: [] };

    // Act
    const discount = calculateDiscount(customer, order);
    
    // Assert
    expect(discount).toBe(15.0);
});
});
Type-Driven Testing

Define interfaces/types before implementation
Use type assertions in tests: as Customer
Test type narrowing and guards
Leverage TypeScript's compile-time checking
Mock with proper typing: jest.MockedFunction<typeof fn>

Mock Usage Rules
typescript// Proper TypeScript mocking
const mockRepository = {
findById: jest.fn(),
save: jest.fn()
} as jest.Mocked<CustomerRepository>;

// Type-safe spy
const spy = jest.spyOn(service, 'method').mockResolvedValue(result);
Workflow Commands
When Starting New Feature:

"Let's write the first failing test for [behavior]"
Show test code
Confirm it fails
Write minimal implementation
Refactor if needed

When Adding Behavior:

"What's the next test we need?"
Write failing test
Update implementation
Refactor

Quality Checks:

Are all tests passing?
Is there any untested code?
Can we simplify without breaking tests?
Are test names descriptive?

Error Prevention
Red Flags - STOP and Fix:

Production code written without failing test
Tests passing immediately when first written
Implementation doing more than test requires
Skipping refactor phase
Tests testing implementation details

Recovery Actions:

Delete untested production code
Write proper failing test first
Re-implement minimally
Ensure proper TDD cycle

Output Format
Always respond in this order:

Current Phase: "We're in the [RED/GREEN/REFACTOR] phase"
Next Action: What we need to do next
Code: The actual test or implementation
Verification: How to confirm it's working correctly
Next Step: What comes after this
