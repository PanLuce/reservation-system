---
name: expand-behavior-to-test-cases
description: Converts identified behaviors into comprehensive test case specifications covering variations, edge cases, and error scenarios
---

# Expand Behavior to Test Cases

Your task is to take identified behaviors and expand them into comprehensive test case specifications that ensure the behavior is correctly and robustly implemented.

## Context Optimization

**BEFORE READING FILES:**
1. Check if relevant files have already been read in the conversation
2. Look for file content with line numbers in recent context
3. Reference existing content instead of re-reading when possible
4. Note: The test orchestrator may have already read the files - check its output

## Core Principle

Each behavior needs multiple test cases to verify:
1. The behavior works correctly (not hardcoded or accidental)
2. The behavior handles edge cases properly
3. The behavior fails gracefully when appropriate

## Analysis Framework

### Step 1: Understand the Behavior

Before expanding into test cases, ensure you understand:
- What is the behavior trying to achieve?
- Who/what depends on this behavior?
- What are the inputs and outputs?
- What could go wrong?
- Is this behavior from a third-party library or your code?

**For components using third-party libraries:**
Only create test cases for YOUR behaviors, not the library's:
- ❌ Skip: "Dropdown opens when clicked" (library behavior)
- ❌ Skip: "Options can be multi-selected" (library behavior)
- ✅ Include: "Store updates with selections" (your integration)
- ✅ Include: "Shows custom count text" (your logic)

### Step 2: Identify Test Dimensions

For each behavior, identify the dimensions that can vary:
- **Input variations**: Different values, types, formats
- **State variations**: Different starting conditions
- **Sequence variations**: Different orders of operations
- **Environmental variations**: Different contexts or configurations

### Step 3: Generate Test Categories

For each behavior, generate test cases in these categories:

#### Core Functionality (Prove it works)
- Primary happy path
- Most common use cases
- Basic expected scenarios

#### Variations (Prove it's not hardcoded)
- Different inputs producing different outputs
- Multiple valid paths to same outcome
- Various combinations of inputs
- Different orderings (if order shouldn't matter)

#### Edge Cases (Prove it's robust)
- Minimum values (empty, zero, single item)
- Maximum values (limits, boundaries)
- Boundary transitions (n-1, n, n+1)
- First/last elements
- Unusual but valid inputs

#### Error Cases (Prove it fails gracefully)
- Invalid inputs
- Missing required data
- Constraint violations
- Unexpected types or formats

#### State Transitions (Prove it handles changes)
- From initial state
- Between valid states
- Rapid changes
- Conflicting changes

### Step 4: Specify Test Cases

For each test case, specify:
- **Given**: The starting context/state
- **When**: The action/trigger
- **Then**: The expected outcome

Keep specifications behavior-focused, not implementation-focused.

### Step 5: Apply Completeness Check

Ask yourself:
- Could a hardcoded implementation pass these tests?
- Are all edge cases covered?
- Would a bug in this behavior be caught by these tests?
- Is each test case actually testing something different?

## Output Format

```
Behavior: [Behavior description]

Test Cases:

Core Functionality:
1. [Test case name]
   - Given: [Context]
   - When: [Action]
   - Then: [Expected outcome]

Variations (proving correct implementation):
2. [Test case name - variation A]
   - Given: [Context]
   - When: [Action with input A]
   - Then: [Expected outcome for A]

3. [Test case name - variation B]
   - Given: [Context]
   - When: [Action with input B]
   - Then: [Expected outcome for B]

Edge Cases:
4. [Test case name - empty/minimum]
   - Given: [Context]
   - When: [Action with minimum input]
   - Then: [Expected outcome]

5. [Test case name - maximum/boundary]
   - Given: [Context]
   - When: [Action with maximum input]
   - Then: [Expected outcome]

Error Cases (if applicable):
6. [Test case name - invalid input]
   - Given: [Context]
   - When: [Invalid action]
   - Then: [Graceful failure]
```

## Examples

### Example 1: Filter Selection Behavior

**Behavior**: Makes user's filter selections available to other components

**Test Cases:**

**Core Functionality:**
1. Single selection updates state
   - Given: No filters selected
   - When: User selects "Leisure & Dining"
   - Then: Application state contains ["leisure-dining"]

**Variations (proving correct implementation):**
2. Different single selections
   - Given: No filters selected
   - When: User selects "City Centers"
   - Then: Application state contains ["city-centers"]

3. Another different selection
   - Given: No filters selected
   - When: User selects "Transit Stations"
   - Then: Application state contains ["transit-stations"]

4. Multiple selections accumulate
   - Given: No filters selected
   - When: User selects "Leisure & Dining" then "City Centers"
   - Then: Application state contains ["leisure-dining", "city-centers"]

5. Different selection order same result
   - Given: No filters selected
   - When: User selects "City Centers" then "Leisure & Dining"
   - Then: Application state contains ["leisure-dining", "city-centers"]

**Edge Cases:**
6. Empty selection
   - Given: No filters selected
   - When: Component renders without user interaction
   - Then: Application state is empty

7. All options selected
   - Given: No filters selected
   - When: User selects all 5 venue types
   - Then: Application state contains all 5 values

8. Select, deselect, reselect
   - Given: "Leisure & Dining" is selected
   - When: User deselects then reselects "Leisure & Dining"
   - Then: Application state contains ["leisure-dining"]

**State Transitions:**
9. Clear from multiple selections
   - Given: Three filters selected
   - When: User clears all
   - Then: Application state becomes empty

10. Partial deselection
    - Given: Three filters selected
    - When: User deselects one
    - Then: Application state contains remaining two

### Example 2: Search Behavior

**Behavior**: Filters displayed items based on search query

**Test Cases:**

**Core Functionality:**
1. Basic search match
   - Given: List contains ["apple", "banana", "apricot"]
   - When: User searches for "ap"
   - Then: Display shows ["apple", "apricot"]

**Variations (proving correct implementation):**
2. Different search term
   - Given: List contains ["apple", "banana", "apricot"]
   - When: User searches for "ban"
   - Then: Display shows ["banana"]

3. No matches
   - Given: List contains ["apple", "banana", "apricot"]
   - When: User searches for "xyz"
   - Then: Display shows empty state with "No results"

4. Case insensitive search
   - Given: List contains ["Apple", "banana", "APRICOT"]
   - When: User searches for "AP"
   - Then: Display shows ["Apple", "APRICOT"]

**Edge Cases:**
5. Empty search query
   - Given: List contains ["apple", "banana", "apricot"]
   - When: Search query is empty
   - Then: Display shows all items

6. Single character search
   - Given: List contains ["apple", "banana", "apricot"]
   - When: User searches for "a"
   - Then: Display shows ["apple", "banana", "apricot"]

7. Special characters in search
   - Given: List contains ["test@example.com", "user@test.com"]
   - When: User searches for "@"
   - Then: Display shows both email addresses

8. Whitespace handling
   - Given: List contains ["apple pie", "banana bread"]
   - When: User searches for "  apple  "
   - Then: Display shows ["apple pie"]

**State Transitions:**
9. Clearing search
   - Given: Search shows filtered results for "ap"
   - When: User clears search field
   - Then: Display shows all items again

10. Rapid search changes
    - Given: List contains many items
    - When: User types "a", then "ap", then "app" quickly
    - Then: Display updates correctly without lag or incorrect states

### Example 3: Component Using Third-Party Library

**Behavior**: Syncs filter selections to application store (using Ark UI Select)

**Test Cases:**

**Core Functionality:**
1. Single selection syncs to store
   - Given: No selections
   - When: User selects "Leisure & Dining"
   - Then: Store contains ["leisure-dining"]

**Variations (proving YOUR logic works):**
2. Different venue types sync correctly
   - Given: No selections
   - When: User selects "City Centers"
   - Then: Store contains ["city-centers"]

3. Multiple selections accumulate
   - Given: No selections
   - When: User selects multiple venue types
   - Then: Store contains all selected values

**What we DON'T test (library's responsibility):**
- ❌ Dropdown opens when clicked
- ❌ Checkmarks appear on selected items
- ❌ Options can be toggled on/off
- ❌ Dropdown stays open during multi-select

**Edge Cases (for YOUR logic):**
4. Clear button removes all from store
   - Given: Multiple selections
   - When: Clear button clicked
   - Then: Store becomes empty

5. Display shows correct count text
   - Given: 0, 1, 3, 5 selections
   - When: Component renders
   - Then: Shows appropriate text

## Anti-Patterns to Avoid

### Testing Implementation Instead of Behavior
❌ "Function calls setState with correct arguments"
✅ "Application state reflects user's selection"

### Testing Library Features
❌ "Dropdown opens when trigger clicked"
✅ "Custom display logic shows selection count"

### Insufficient Variations
❌ Only testing one specific input/output pair
✅ Testing multiple different inputs to prove general implementation

### Missing Edge Cases
❌ Only testing normal operations
✅ Including empty, boundary, and extreme cases

### Redundant Test Cases
❌ Multiple tests that would fail/pass together
✅ Each test case covers a distinct scenario

## Quality Checklist

Before finalizing test cases, verify:
- [ ] Core functionality is covered
- [ ] Multiple variations prove it's not hardcoded
- [ ] Edge cases are identified and specified
- [ ] Error cases are covered (where applicable)
- [ ] State transitions are tested
- [ ] No redundant test cases
- [ ] A bug in the behavior would cause at least one test to fail
- [ ] Test cases are behavior-focused, not implementation-focused
- [ ] Could refactoring break these tests unnecessarily? (If yes, they test implementation)
- [ ] Do test cases read like specifications? (If no, rethink naming/structure)