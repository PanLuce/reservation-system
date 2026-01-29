---
name: test-orchestrator
description: |
  AUTOMATIC TRIGGERS: "write tests", "create tests", "add tests", "test this", "write test for", "test coverage", "unit test", "integration test"
  Orchestrates all testing skills to comprehensively write new tests or review and improve existing tests.
  USE THIS IMMEDIATELY when user mentions any form of test writing or review. DO NOT attempt manual test writing first.
---

# Test Orchestrator

This skill orchestrates all testing skills to either write comprehensive new tests or review and improve existing tests. It ensures all aspects of testing are covered systematically.

## Context Optimization

**IMPORTANT:** Before reading any files, check if they have already been read in this conversation:
- Look for file content in the recent context (marked with file paths and line numbers)
- If the file content is already visible, reference it instead of re-reading
- Only read files that haven't been loaded yet or when you need to verify current state
- When invoking sub-skills, pass along information about which files have already been read

**Already-read indicators to look for:**
- File paths like `src/features/...` followed by numbered lines
- Code blocks with line numbers (e.g., `1→`, `2→`, etc.)
- Previous skill outputs that include file content

## Core Principle

Testing requires multiple perspectives and skills. This orchestrator ensures you apply them all in the right sequence for comprehensive test coverage and quality.

**Remember:** Tests should be **expressive and read like documentation**. The final step (structure-test-properly) includes creating fluent assertion APIs and helper functions that use domain language. Tests are living documentation that never goes out of date.

## CRITICAL: How to Invoke Sub-Skills

**IMPORTANT:** All the skills mentioned in this orchestrator (`understand-behavior-to-test`, `expand-behavior-to-test-cases`, etc.) are SKILLS, not agents.

**Use the Skill tool to invoke them:**
```
Correct: Skill tool with command: "understand-behavior-to-test"
Wrong:   Task tool with subagent_type: "understand-behavior-to-test"
```

The sub-skills are:
- `understand-behavior-to-test` - Identifies testable behaviors
- `expand-behavior-to-test-cases` - Expands behaviors into test cases
- `choose-mocking-strategy` - Determines what to mock
- `test-implementation-strategy` - Plans testing approach
- `structure-test-properly` - Writes well-structured tests
- `tdd-cycle` - For test-driven development flow

**Always use the Skill tool, NOT the Task tool, to invoke these.**

## Workflow for NEW Tests

When writing tests for new or untested code (including existing code without tests):

### Step 0: Combat Implementation Bias (if code already exists)
**For existing code without tests:**
- Read the code to understand the PUBLIC API only
- **Pretend you don't know the internal implementation**
- Focus on what the code enables users to do, not how it works
- Treat it as a black box

### Step 1: Understand Behaviors
**Use:** `understand-behavior-to-test` skill
- Identify what behaviors the component/function provides
- Distinguish between library behaviors and custom logic
- Focus on observable outcomes, not implementation
- For existing code: Reverse-engineer behaviors from the public API

**Output:** List of behaviors to test

### Step 2: Expand Test Cases
**Use:** `expand-behavior-to-test-cases` skill
- For each behavior, identify:
  - Core functionality cases
  - Variations (to prove it's not hardcoded)
  - Edge cases
  - Error cases
- Skip test cases for third-party library features

**Output:** Comprehensive test case specifications

### Step 3: Determine Implementation Strategy
**Use:** `test-implementation-strategy` skill
- Decide assertion targets (DOM, state, responses)
- Choose testing level (unit, integration, component)
- Determine mocking boundaries
- Plan async handling

**Output:** Implementation approach for each test case

### Step 4: Structure and Write Tests
**Use:** `structure-test-properly` skill
- Apply Given/When/Then pattern
- Create helper functions for expressiveness
- Organize with proper beforeEach blocks
- Ensure clean DSL over testing mechanics

**Output:** Well-structured, readable test code

## Workflow for REVIEWING Existing Tests

When reviewing or improving existing tests:

### Step 1: Analyze Current Coverage
**Use:** `understand-behavior-to-test` skill
- List all behaviors the component should have
- Check which behaviors are currently tested
- Identify gaps in behavior coverage

**Questions to answer:**
- What behaviors are missing tests?
- Are we testing library features instead of our logic?
- Is the component's responsibility clear?

### Step 2: Evaluate Test Completeness
**Use:** `expand-behavior-to-test-cases` skill
- For each tested behavior, check if we have:
  - Sufficient variations (not just one case)
  - Edge cases
  - Error handling
- Identify missing test cases

**Questions to answer:**
- Could a hardcoded implementation pass these tests?
- Are edge cases covered?
- Are there enough variations?

### Step 3: Assess Testing Approach
**Use:** `test-implementation-strategy` skill
- Review current assertion strategies
- Check if testing at right boundaries
- Evaluate mocking decisions
- Verify async handling

**Common issues to look for:**
- Testing too deep (implementation details)
- Over-mocking (mocking internal collaborators)
- Wrong assertion targets
- Testing library behavior

### Step 4: Evaluate Structure and Readability
**Use:** `structure-test-properly` skill
- Check Given/When/Then structure
- **Verify the "When" clause exists** (often missing!)
- Assess test expressiveness
- Look for helper function opportunities

**Common issues to look for:**
- Missing "When" blocks
- Test logic in test bodies instead of beforeEach
- Poor test names
- Testing mechanics exposed instead of clean DSL

### Step 5: Identify Anti-patterns
**Additional checks:**
- Testing internal state instead of outcomes
- Testing that TypeScript already guarantees
- Redundant tests
- Tests that always pass
- Brittle selectors

## Review Output Format

When reviewing tests, provide:

```markdown
## Test Review: [Component Name]

### Coverage Analysis
**Behaviors identified:** X
**Behaviors tested:** Y
**Missing behaviors:**
- [Behavior 1]
- [Behavior 2]

### Test Case Completeness
**Well-tested behaviors:**
- [Behavior]: Has variations, edge cases

**Under-tested behaviors:**
- [Behavior]: Missing edge cases
- [Behavior]: Only one variation (could be hardcoded)

### Testing Approach Issues
- ❌ Testing library dropdown behavior (lines X-Y)
- ❌ Over-mocked internal store (line Z)
- ✅ Correctly testing at store boundary

### Structure Issues
- ❌ Missing "When" blocks (lines X-Y)
- ❌ Test logic not in beforeEach (line Z)
- ❌ Poor expressiveness - exposing testing mechanics

### Recommendations
1. Add tests for [missing behaviors]
2. Add variations for [behavior] to prevent hardcoding
3. Remove tests for library features (lines X-Y)
4. Extract helper functions for better expressiveness
5. Add proper When blocks to clarify triggers
```

## Decision Tree

```
What is the testing situation?
├─ No tests exist (retrofitting)
│   ├─ 0. Combat implementation bias (read public API only)
│   ├─ 1. Identify behaviors (understand-behavior-to-test)
│   ├─ 2. Expand test cases (expand-behavior-to-test-cases)
│   ├─ 3. Determine mocking strategy (choose-mocking-strategy)
│   ├─ 4. Plan implementation (test-implementation-strategy)
│   └─ 5. Write structured tests (structure-test-properly)
│
├─ Writing tests for new code
│   ├─ 1. Identify behaviors (understand-behavior-to-test)
│   ├─ 2. Expand test cases (expand-behavior-to-test-cases)
│   ├─ 3. Plan implementation (test-implementation-strategy)
│   └─ 4. Write structured tests (structure-test-properly)
│
└─ Review/improve existing tests
    ├─ 1. Check behavior coverage (understand-behavior-to-test)
    ├─ 2. Check test completeness (expand-behavior-to-test-cases)
    ├─ 3. Check testing approach (test-implementation-strategy)
    ├─ 4. Check structure/readability (structure-test-properly)
    └─ 5. Identify anti-patterns and provide recommendations
```

## Key Principles to Enforce

### For Components Using Libraries
- Test YOUR code, not the library
- Focus on your business logic, state management, and custom display
- Skip standard UI mechanics the library provides

### For Test Structure
- **ALWAYS have Given/When/Then** with When being explicit
- Test behaviors, not implementation
- Use helper functions for expressiveness
- Keep tests DRY but readable

### For Test Expressiveness
- **Invest in fluent assertion APIs** when assertions repeat
- **Use domain language over test language** (e.g., `hasVisibleSiteCount()` not `toHaveLength()`)
- **Create helper functions** to hide testing mechanics (e.g., `renderScreenExplorer()`)
- **Tests should read like specifications** - anyone can understand them
- Progress through: Raw mechanics → Hidden mechanics → Fluent API

### For Test Coverage
- Multiple variations to prove general implementation
- Edge cases for robustness
- Clear connection between test and behavior

## Common Refactoring Patterns

### Pattern 1: Exposing Mechanics → Clean DSL
**Before:**
```typescript
expect(screen.getByRole("combobox")).toHaveTextContent("3 venue types");
```

**After:**
```typescript
venueTypeFilter.button.shows("3 venue types");
```

### Pattern 2: Missing When → Clear Trigger
**Before:**
```typescript
describe("Given state X", () => {
  beforeEach(() => {
    setupState();
    render(<Component />);
  });
  test("Then shows Y", () => {
    expect(Y).toBeVisible();
  });
});
```

**After:**
```typescript
describe("Given state X", () => {
  beforeEach(() => {
    setupState();
  });
  describe("When component renders", () => {
    beforeEach(() => {
      render(<Component />);
    });
    test("Then shows Y", () => {
      expect(Y).toBeVisible();
    });
  });
});
```

### Pattern 3: Testing Library → Testing Custom Logic
**Before:**
```typescript
test("dropdown opens when clicked", () => {
  fireEvent.click(trigger);
  expect(dropdown).toBeVisible();
});
```

**After:**
```typescript
// Remove this test - it's testing the library
// Instead test your custom logic that uses the dropdown
```

## Success Criteria

Tests are successful when:
1. All behaviors are tested (not just some)
2. Each behavior has sufficient test cases
3. Tests focus on outcomes, not mechanisms
4. Structure follows Given/When/Then with clear When
5. Tests read like specifications
6. No library features are tested
7. Tests will survive refactoring