---
name: test-implementation-strategy
description: Determines the optimal testing approach for implementing identified test cases - what to assert, at what level, and through which boundaries
---

# Test Implementation Strategy

Your task is to determine HOW to implement test cases that have been identified. This skill bridges the gap between knowing what to test and writing the actual test code.

## Context Optimization

**BEFORE READING FILES:**
1. Check if test cases and component files are already in context
2. Look for existing content from test orchestrator or previous skills
3. Reference existing file content instead of re-reading
4. Only read new files that haven't been loaded yet

## Core Principle

Choose the testing approach that:
1. Tests at the appropriate boundary
2. Provides confidence without brittleness
3. Will survive refactoring
4. Clearly expresses intent

## Decision Framework

### Step 1: Identify the Component's Contract

**Determine the component's observable boundaries:**
- **UI Components**: What users can see and interact with
- **State Managers**: The state that other components consume
- **Services**: The API responses or side effects
- **Utilities**: The returned values or transformations
- **Coordinators**: The orchestration between components
- **Library Wrappers**: Your customizations on top of library behavior

**For components using third-party libraries:**
Separate what the library handles from what you added:
- Library handles: Basic UI mechanics, standard behaviors
- You handle: Business logic, state integration, custom display
- Test only: Your additions, not the library's features

### Step 2: Choose the Assertion Target

Based on the component type and its contract:

#### For UI Components Managing Shared State
**Assert on:** The shared state that other components consume
**Why:** The state IS the component's output mechanism
**Example:** Filter component → Assert store contains selected filters

#### For UI Components Displaying Data
**Assert on:** The rendered DOM elements
**Why:** The visual output IS the component's purpose
**Example:** List component → Assert items appear in DOM

#### For Services/API Layers
**Assert on:** Response data, status codes, headers
**Why:** The API contract IS what consumers depend on
**Example:** API service → Assert response shape and values

#### For Business Logic
**Assert on:** Computed values, transformations, decisions
**Why:** The logic outcome IS what matters
**Example:** Calculator → Assert calculation results

#### For Event Handlers
**Assert on:** The effects of the event
**Why:** The outcome matters, not the event mechanism
**Example:** Click handler → Assert what changed, not handler call

### Step 3: Determine Testing Level

#### Unit Test When:
- Testing isolated business logic
- Testing specific edge cases
- Testing error conditions
- Component has clear boundaries
- Fast feedback is critical

#### Integration Test When:
- Testing coordination between components
- Testing data flow through system
- Testing realistic usage patterns
- Components are tightly coupled
- Confidence in integration is critical

#### Component Test When:
- Testing complete component behavior
- Testing user interactions
- Testing component state management
- Visual feedback is important

### Step 4: Choose Assertion Strategy

#### Test Outcomes, Not Mechanisms
```
❌ BAD: Verify function was called
✅ GOOD: Verify the effect of that function
```

#### Assert at the Right Abstraction Level
```
❌ BAD: Check internal state variable
✅ GOOD: Check observable state through public API
```

#### Use Stable Selectors
```
❌ BAD: Assert on CSS classes or implementation details
✅ GOOD: Assert on semantic elements, roles, or data
```

#### One Assertion Focus Per Test
```
❌ BAD: Assert both DOM and state in same test
✅ GOOD: Separate tests for different concerns
```

### Step 5: Handle Async Behavior

#### For State Updates
- Use `waitFor` when state changes trigger renders
- Assert after state has stabilized
- Don't test intermediate states unless they matter

#### For API Calls
- Wait for response, not for request
- Assert on final state, not loading states (unless testing those specifically)
- Use realistic timeouts

#### For User Interactions
- Wait for effects to complete
- Assert on final UI state
- Consider debounced/throttled inputs

### Step 6: Determine Mock Boundaries

#### Mock External Boundaries
- External APIs
- Browser APIs (when not testing integration)
- Third-party services
- File system/Database (in unit tests)

#### Don't Mock Internal Collaborators
- State stores (in component tests)
- Utility functions
- Internal services
- Child components (unless necessary)

## Output Format

For each test case, provide:

```
Test Case: [Name from test case specification]
Testing Level: [Unit/Integration/Component]
Assertion Target: [What to check - state/DOM/response/etc.]
Assertion Strategy: [How to verify the outcome]
Mock Strategy: [What to mock, if anything]
Async Handling: [How to handle async, if applicable]
```

## Examples

### Example 1: Filter Component Behavior

**Behavior:** Makes filter selections available to other components

**Test Case:** User selects multiple venue types

**Implementation Strategy:**
- **Testing Level:** Component test
- **Assertion Target:** Store state (via `useFilterStore.getState()`)
- **Assertion Strategy:** Verify store contains exactly the selected values
- **Mock Strategy:** No mocks - test with real store
- **Async Handling:** Use `waitFor` for state updates after user interaction

**Rationale:** The store state IS the component's output. Other components consume this state, so it's the appropriate boundary to test.

### Example 2: API Service Behavior

**Behavior:** Fetches user profile data

**Test Case:** Successfully retrieves user data

**Implementation Strategy:**
- **Testing Level:** Integration test
- **Assertion Target:** Service response shape and data
- **Assertion Strategy:** Verify response contains expected user fields
- **Mock Strategy:** Mock HTTP client, use real service logic
- **Async Handling:** Await service call, assert on resolved value

**Rationale:** Consumers depend on the response contract, not how the data is fetched.

### Example 3: List Display Component

**Behavior:** Displays filtered items based on search

**Test Case:** Shows only matching items

**Implementation Strategy:**
- **Testing Level:** Component test
- **Assertion Target:** Rendered DOM elements
- **Assertion Strategy:** Query for item elements, verify only matches are present
- **Mock Strategy:** No mocks - use real filtering logic
- **Async Handling:** None needed if synchronous

**Rationale:** The visual display IS the component's purpose. Users see DOM, not internal state.

### Example 4: Component Using Third-Party Library

**Component:** VenueTypeFilter (using Ark UI Select)

**Behavior:** Syncs venue type selections to filter store

**Test Case:** Selecting venue types updates store

**Implementation Strategy:**
- **Testing Level:** Component test
- **Assertion Target:** Store state only (NOT Ark UI mechanics)
- **Assertion Strategy:** Verify store contains selected values
- **Mock Strategy:** No mocks - let Ark UI work normally
- **Async Handling:** waitFor store updates after interaction

**What NOT to test:**
- Dropdown opening/closing (Ark's responsibility)
- Checkmark rendering (Ark's responsibility)
- Multi-select toggle behavior (Ark's responsibility)

**What TO test:**
- Store contains correct values after selection
- Custom display text ("3 venue types")
- Clear button visibility and functionality

**Rationale:** Test only the thin layer of logic you added on top of the library. The library's behavior is already tested by its maintainers.

## Guidelines

### Prefer Outcomes Over Mechanisms
Always ask: "What does the consumer of this component care about?"

### Test at the Appropriate Boundary
- Don't reach deeper than necessary
- Don't test at too high a level for unit behaviors
- Match test level to confidence needs

### Keep Tests Maintainable
- Choose assertions that won't break with refactoring
- Avoid coupling to implementation details
- Use semantic queries over structure-dependent ones

### Balance Confidence and Speed
- Unit tests for fast feedback on logic
- Integration tests for confidence in connections
- Don't duplicate testing at multiple levels unnecessarily

## Anti-Patterns to Avoid

### Testing Multiple Boundaries
❌ Asserting both store state AND DOM in one test
✅ Separate tests for different aspects

### Over-Mocking
❌ Mocking every dependency
✅ Only mock external boundaries

### Testing Implementation Details
❌ Asserting on internal method calls
✅ Asserting on observable outcomes

### Wrong Level Assertions
❌ Unit testing UI rendering
✅ Component testing UI, unit testing logic

### Brittle Selectors
❌ Using CSS classes or DOM structure
✅ Using semantic HTML, roles, or test IDs

## Decision Tree

```
Is this a UI component?
├─ Yes → Does it manage shared state?
│   ├─ Yes → Assert on shared state
│   └─ No → Assert on DOM
└─ No → Is it a service/API?
    ├─ Yes → Assert on responses/effects
    └─ No → Is it business logic?
        ├─ Yes → Assert on computed values
        └─ No → Assert on transformations/output
```

## Key Questions to Answer

Before implementing any test, answer:
1. What is the observable boundary of this component?
2. What do consumers of this component depend on?
3. What level of testing provides appropriate confidence?
4. What would break if this behavior was incorrect?
5. What assertions would survive a refactor?