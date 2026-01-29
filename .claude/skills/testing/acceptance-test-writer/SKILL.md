---
name: acceptance-test-writer
description: Write persona-driven acceptance tests using domain language that reads like natural language. This skill should be used when users request to write, help write, create, or refactor acceptance tests for user-facing features. Tests use personas (users like Petra or Jakub) and express behavior in real-world terms without computer implementation details.
---

# Acceptance Test Writer

## Overview

Write acceptance tests that describe user behavior in domain language, not computer language. Tests follow a persona-driven approach where personas (like Petra or Jakub) perform actions and observe outcomes as if working with physical tools (maps, catalogs, forms) rather than software. The goal is tests readable by domain experts who have never seen the code.

## Core Philosophy: Domain Language Over Computer Language

**The Golden Rule**: Write tests as if computers don't exist.

Before creating any DSL method or test description, ask:

> "Would this make sense if the persona was working with physical objects instead of software?"

**Examples**:
- ✅ `petra.looksAt("Berlin")` - Works with a physical map
- ✅ `jakub.wantsToSeeOnly("high traffic locations")` - Clear human intent
- ❌ `petra.filtersBy("city")` - Filtering is what computers do
- ❌ `jakub.clicksOnMarker("Berlin")` - Implementation detail

**The full philosophy guide is in `references/philosophy.md`**. Read this first to deeply understand domain vs computer language.

## When to Use This Skill

Use this skill when the user requests:
- "Write an acceptance test for [feature]"
- "Help me write acceptance tests"
- "Create acceptance tests for the [feature] flow"
- "Refactor this acceptance test"
- "Add acceptance test coverage for [behavior]"

## Workflow

### Step 1: Understand the Feature Behavior

Ask clarifying questions to understand WHAT the persona wants to accomplish, not HOW the system works:

**Good questions**:
- "What is the persona trying to accomplish?"
- "What does the persona need to see or observe?"
- "What is the persona's goal or intent?"
- "How would this work if it were a physical process?"

**Avoid questions about**:
- How the UI is implemented
- What API endpoints exist
- How state is managed
- What components are involved

### Step 2: Identify or Create Personas

**Use existing personas** from the DSL if they match the user's mental model:
- Review existing persona classes (e.g., `Petra.ts`, `Jakub.ts`)
- Each persona represents a specific user type with distinct needs

**Create new personas** only if:
- The behavior represents a fundamentally different user type
- Existing personas don't match the mental model
- The domain requires a distinct role (e.g., "Admin" vs "Viewer")

### Step 3: Propose Test Scenarios

**CRITICAL**: Before writing any code, propose the test scenarios in natural language and get user approval.

**First, check existing DSL methods** by reading:
- `src/features/screen-explorer/acceptance-tests/dsl/MapExploringPersona.tsx`
- `src/features/screen-explorer/acceptance-tests/dsl/Petra.tsx`
- `src/features/screen-explorer/acceptance-tests/dsl/Jakub.tsx`
- `src/features/cart/acceptance-tests/dsl/` (if cart-related)

Present the proposed test structure as a narrative outline:

```
Feature: [Feature Name]

Persona: [Persona Name]

Test Scenarios:
1. Given [preconditions]
   When [persona action]
   Then [expected outcome]

2. Given [different preconditions]
   When [persona action]
   Then [expected outcome]

Proposed DSL methods:
- Existing (reuse): persona.looksAt(), persona.seesScreen()
- New (if needed): persona.wantsToSeeOnly(), persona.comparesScreens()
- Rationale for new methods: [explain why existing methods don't suffice]
```

**Ask for approval**:
- "Does this capture the behavior you want to test?"
- "Are the test scenarios expressed in domain language?"
- "Should any DSL method names be reconsidered?"

**Only proceed to Step 4 after receiving confirmation** that:
1. The scenarios capture the right behavior
2. The descriptions use domain language (not computer language)
3. The DSL method names make sense in the real world
4. Any new method names pass the "physical tools" test

If the user identifies issues, iterate on the proposal before writing code.

### Step 4: Structure the Test Using Given-When-Then

Follow the strict nesting pattern shown in `references/example-test.tsx`:

```typescript
test.describe("Feature Name", () => {
  // Setup context
  test.beforeEach(async ({ page, mount }) => {
    context = new TestContext(page, mount);
  });

  test.describe("Given [Persona] persona", () => {
    let persona: Persona;

    test.beforeEach(async () => {
      persona = new Persona(context);
      // Initial persona setup
    });

    test.describe("Given [preconditions]", () => {
      test.beforeEach(async () => {
        // Set up test data
      });

      test.describe("When [persona action]", () => {
        test.beforeEach(async () => {
          // Perform action
        });

        test("Then [expected outcome]", async () => {
          // Assert behavior
        });
      });
    });
  });
});
```

**Structure rules**:
1. Top-level: Feature name only
2. Second-level: Persona introduction (`"Given [Persona] persona"`)
3. Nested describes: Additional Given/When/Then context
4. Test cases: Final assertions (`"Then [outcome]"`)

### Step 5: Write DSL Method Calls

**Note**: This step only happens after Step 3 approval.

**CRITICAL: Always check existing DSL methods first**

Before proposing any new DSL method, you MUST:

1. **Read the existing DSL implementation files** to discover what methods already exist:
   - `src/features/screen-explorer/acceptance-tests/dsl/MapExploringPersona.tsx` - Core map and site exploration methods
   - `src/features/screen-explorer/acceptance-tests/dsl/Petra.tsx` - Petra persona methods
   - `src/features/screen-explorer/acceptance-tests/dsl/Jakub.tsx` - Jakub persona methods
   - `src/features/cart/acceptance-tests/dsl/` - Cart-related methods (if relevant)

2. **Search for methods with similar intent**: Use grep/search to find methods whose names suggest they might serve your purpose

3. **Evaluate domain expressiveness**: Ask yourself:
   - Does the existing method name express the domain intent clearly enough?
   - Would reusing this method make the test read naturally in domain language?
   - Does the method signature accept the parameters I need?

4. **Reuse existing methods** whenever:
   - The domain meaning is identical or very close
   - The test remains expressive and readable with the existing method name
   - The method signature supports your use case

5. **Only propose new methods** when:
   - No existing method expresses the persona's intent adequately
   - Using an existing method would make the test read awkwardly or lose domain clarity
   - The domain language specifically demands a different term
   - The existing method's signature doesn't match your needs

**Example evaluation**:
```
Need: Test filtering sites by venue type
Found: `jakub.looksForSitesAt("Shopping & Groceries")`
Question: Is this expressive enough in domain language?
Answer: Yes - "looks for sites at Shopping centers" reads naturally
Decision: REUSE existing method
```

**Anti-pattern**:
```
Need: Test filtering sites by venue type
Found: `jakub.looksForSitesAt("Shopping & Groceries")`
Thought: "I want a more specific name like filtersByVenueType"
Problem: "filtersBy" is computer language, not domain language
Decision: REUSE existing method - it's already domain-appropriate
```

**Naming patterns for new methods**:

**Actions (what persona DOES)**:
```typescript
persona.opensAMap()
persona.looksAt("location")
persona.searchesFor("criteria")
persona.selectsScreen("name")
persona.wantsToSee("description")
persona.isInterestedIn("category")
```

**Observations (what persona SEES)**:
```typescript
persona.seesScreen("name")
persona.seesScreens(["name1", "name2"])
persona.doesNotSeeScreen("name")
persona.seesDetails("information")
persona.seesMessageSaying("text")
```

**Be specific about WHERE the persona observes things**:

When multiple UI components might show the same data, specify which one the persona is looking at:

✅ `jakub.seesSitesOnMap(["Berlin", "Munich"])` - Clear: looking at the map
✅ `jakub.seesSitesInList(["Berlin", "Munich"])` - Clear: looking at a list
✅ `jakub.seesListedSites(["Berlin", "Munich"])` - Clear: in a catalog/list
❌ `jakub.seesSites(["Berlin", "Munich"])` - Ambiguous if both map and list exist

**Real-world analogies help clarify complex interactions**:

When dealing with filters, selections, or data transformations, use physical-world analogies:

Example: Venue type filtering
- 🎯 "Think of venue type filtering like putting a transparent overlay on a physical atlas that only shows shopping centers, or only shows train stations"
- 💭 This helps establish: `jakub.looksForSitesAt("shopping centers")` feels like Jakub selecting which overlay to put on his atlas
- ✅ The method name naturally follows from the analogy

Example: Geographic bounds
- 🎯 "Like opening a physical atlas to the Berlin page - you only see what's on that page"
- 💭 This helps establish: `jakub.looksAt("Berlin")` feels like turning to a specific page
- ✅ The method name describes the action, not the filtering mechanism

**Setup (test infrastructure - acceptable computer language)**:
```typescript
sites.existAt(["location1", "location2"])
bookings.existFor(["campaign1"])
inventory.hasCapacityOf(100)
```

### Step 6: Challenge Computer Language

For every DSL method call, perform the "Real-World Test":

1. Would this make sense with physical objects (map atlas, catalog, paper form)?
2. Does this describe WHAT the persona wants, not HOW the system does it?
3. Could a non-technical domain expert understand this?

If any answer is "no", rethink the method name.

**Common traps**:
- ❌ System actions: `persona.showsLocations()` → ✅ `persona.wantsToSeeOnly()`
- ❌ Computer mechanisms: `persona.filtersBy()` → ✅ `persona.looksFor()`
- ❌ UI implementation: `persona.clicksOnMarker()` → ✅ `persona.selectsScreen()`
- ❌ Technical state: `persona.expectsMapStateToContain()` → ✅ `persona.seesScreens()`

### Step 7: Write Clear Test Descriptions

Test descriptions should read like a story:

```typescript
// GOOD - Reads like a narrative
test.describe("Given Petra persona", () => {
  test.describe("When Petra looks at a map of Berlin", () => {
    test("Then Petra sees the screen at U-Bahn entrance", async () => {
      // ...
    });
  });
});

// BAD - Technical descriptions
test.describe("Petra tests", () => {
  test.describe("Map viewport set to Berlin", () => {
    test("Should render marker correctly", async () => {
      // ...
    });
  });
});
```

### Step 8: Keep Tests Focused

**One assertion per test**:
```typescript
// GOOD - Single clear outcome
test("Then Petra sees available screens", async () => {
  await petra.seesScreens(["Berlin", "Munich"]);
});

// BAD - Multiple unrelated assertions
test("Then Petra sees screens and can book them", async () => {
  await petra.seesScreens(["Berlin", "Munich"]);
  await petra.booksScreen("Berlin");
});
```

**One action per When**:
```typescript
// GOOD - Clear action boundary
test.describe("When Petra selects a screen", () => {
  test.beforeEach(async () => {
    await petra.selectsScreen("Berlin");
  });

  test("Then Petra sees screen details", async () => {
    await petra.seesDetails("Information");
  });
});
```

## Testing Patterns

### Pattern: Visibility Testing

```typescript
test.describe("Given screens exist at multiple locations", () => {
  test.beforeEach(async () => {
    await sites.existAt(["Berlin", "Munich", "Hamburg"]);
  });

  test.describe("When Jakub looks at Germany", () => {
    test.beforeEach(async () => {
      await jakub.looksAt("Germany");
    });

    test("Then Jakub sees all three locations", async () => {
      await jakub.seesScreens(["Berlin", "Munich", "Hamburg"]);
    });
  });
});
```

### Pattern: State Transitions

```typescript
test.describe("Given Petra is looking at Berlin", () => {
  test.beforeEach(async () => {
    await petra.looksAt("Berlin");
  });

  test.describe("When Petra changes to Munich", () => {
    test.beforeEach(async () => {
      await petra.looksAt("Munich");
    });

    test("Then Petra sees Munich screens", async () => {
      await petra.seesScreens(["Munich Marienplatz"]);
    });

    test("Then Petra no longer sees Berlin screens", async () => {
      await petra.doesNotSeeScreen("Berlin Alexanderplatz");
    });
  });
});
```

### Pattern: Data Filtering/Narrowing

```typescript
test.describe("Given 10 screens exist across Germany", () => {
  test.beforeEach(async () => {
    await sites.existAt([...allLocations]);
  });

  test.describe("When Jakub looks at only Berlin", () => {
    test.beforeEach(async () => {
      await jakub.looksAt("Berlin");
    });

    test("Then Jakub sees only Berlin locations", async () => {
      await jakub.seesListedSites([...berlinLocations]);
    });
  });
});
```

## Deliverable Format

Produce a complete test file with:

1. **Imports**: TestContext, personas, and test helpers
2. **Test structure**: Proper Given-When-Then nesting
3. **DSL method calls**: Using existing or new methods as needed
4. **Domain language**: No computer implementation details

**The test will fail if DSL methods don't exist yet** - this is expected and correct. The failing test drives TDD implementation of the DSL.

**Do not**:
- Add TODO comments for missing DSL methods
- Implement the DSL classes (that's a separate task)
- Include implementation details in test descriptions
- Guess at how the system works internally

## Reference Files

**Read these files for comprehensive guidance**:

1. **`references/philosophy.md`**: Deep dive on domain vs computer language with many examples
2. **`references/example-test.tsx`**: Complete working example showing all patterns
3. **`references/dsl-guidelines.md`**: Practical guidelines for test structure, method naming, and common patterns

Load these references as needed when writing tests. The philosophy guide should be read first to understand the core principle.

## Common Mistakes to Avoid

1. **Using computer verbs**: `filters`, `renders`, `updates`, `sets`, `gets`
2. **System perspective**: Methods describing what the system does, not what the persona does
3. **Implementation details**: References to clicks, components, state, APIs
4. **Multiple actions**: More than one When per test path
5. **Multiple assertions**: More than one Then per test
6. **Vague descriptions**: Test names that don't clearly state the expected behavior

## Summary

The goal is tests that:
- Read like a story about a person using physical tools
- Are understandable by non-technical domain experts
- Express WHAT should happen, not HOW it happens
- Use personas to represent different user mental models
- Follow strict Given-When-Then structure
- Challenge every method name with "Would this work without computers?"
