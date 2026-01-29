# DSL Guidelines for Acceptance Tests

## Test Structure Pattern

Acceptance tests follow a strict Given-When-Then structure using nested `test.describe` blocks:

```typescript
test.describe("Feature Name", () => {
  // Setup test context and shared resources
  test.beforeEach(async ({ page, mount }) => {
    context = new TestContext(page, mount);
    sites = new Sites(context);
  });

  test.describe("Given [persona] persona", () => {
    let persona: Persona;

    test.beforeEach(async () => {
      persona = new Persona(context);
      // Initial persona setup
    });

    test.describe("Given [preconditions]", () => {
      test.beforeEach(async () => {
        // Set up test data and preconditions
      });

      test.describe("When [persona action]", () => {
        test.beforeEach(async () => {
          // Perform the action being tested
        });

        test("Then [expected outcome]", async () => {
          // Assert observable behavior
        });
      });
    });
  });
});
```

### Structure Rules

1. **Top-level describe**: Feature/component name only
2. **Second-level describe**: Persona introduction (`"Given [Persona] persona"`)
3. **Nested describes**: Additional context using Given/When/Then
4. **Test cases**: Final assertions (`"Then [outcome]"`)

### Given-When-Then Usage

**Given** - Setup and preconditions:
- `"Given Petra persona"` - Introduce the persona
- `"Given a site exists at Alexanderplatz"` - Test data setup
- `"Given screens exist in 3 cities"` - Multiple preconditions

**When** - Actions being tested:
- `"When Petra looks at a map of Berlin"` - Primary action
- `"When Jakub looks away from Berlin to Munich"` - State change

**Then** - Expected outcomes:
- `"Then Petra sees the screen at U-Bahn entrance"` - Observable result
- `"Then Jakub does not see the Marienplatz screen"` - Negative assertion

## DSL Method Naming Patterns

### Persona Actions (What the persona DOES)

```typescript
// Opening/Starting
persona.opensAMap()
persona.startsBooking()
persona.beginsSearching()

// Looking/Viewing
persona.looksAt("Berlin")
persona.looksFor("high traffic locations")
persona.viewsDetails("Alexanderplatz")

// Selecting/Choosing
persona.selectsScreen("Marienplatz")
persona.choosesLocation("Hamburg")
persona.picksDateRange("2025-01-01", "2025-01-31")

// Wanting/Intending (expressing desire/intent)
persona.wantsToSee("business districts")
persona.isInterestedIn("train stations")
persona.needsToFind("locations near airports")

// Searching/Finding
persona.searchesFor("Munich")
persona.findsLocationNear("Berlin Hauptbahnhof")
```

### Persona Observations (What the persona SEES)

```typescript
// Positive assertions
persona.seesScreen("location name")
persona.seesScreens(["location1", "location2"])
persona.seesListedSites(["site1", "site2"])
persona.seesDetails("information")
persona.seesPrice("€1,200")

// Negative assertions
persona.doesNotSeeScreen("location name")
persona.doesNotSeeAnyScreens()
persona.cannotSeeLocation("hidden location")

// State observations
persona.seesMapCenteredOn("Berlin")
persona.seesScreenMarkedAs("available")
persona.seesMessageSaying("Booking confirmed")
```

### Setup Actions (Test infrastructure - not persona behavior)

```typescript
// Data setup (acceptable computer language)
sites.existAt(["Berlin", "Munich"])
bookings.existFor(["campaign1", "campaign2"])
inventory.hasCapacityOf(100)

// Context setup (test infrastructure)
context = new TestContext(page, mount)
```

## When to Reuse vs Create New DSL Methods

### ✅ Reuse Existing Methods When:

1. **Exact semantic match**: The existing method name perfectly describes the persona's intent
   ```typescript
   // Reuse: petra.looksAt("Munich")
   // Don't create: petra.viewsMapOf("Munich")
   ```

2. **Same abstraction level**: The method operates at the right level of detail
   ```typescript
   // Reuse: petra.seesScreen("location")
   // Don't create: petra.seesScreenMarker("location")
   ```

3. **Domain meaning is identical**: Different words but same real-world action
   ```typescript
   // Reuse: petra.selectsScreen("location")
   // Don't create: petra.choosesScreen("location")
   ```

### ✅ Create New Methods When:

1. **Different intent**: The action has a different purpose even if similar mechanism
   ```typescript
   // Different from looksAt():
   petra.searchesFor("restaurants near station")  // Finding specific criteria
   petra.looksAt("Berlin")                        // Viewing a location
   ```

2. **Different abstraction**: A higher or lower level operation is needed
   ```typescript
   // More specific than seesScreen():
   petra.seesScreenMarkedAsAvailable("location")
   petra.seesScreen("location")  // Just visibility
   ```

3. **Domain language requires it**: Real-world terminology demands a specific term
   ```typescript
   // Booking domain:
   jakub.reservesScreensFor("January 2025")  // Not "selects" or "picks"

   // Search domain:
   petra.narrowsDownTo("city centers")       // Not "filters" or "sets"
   ```

4. **Expressiveness wins**: The new name makes the test dramatically clearer
   ```typescript
   // More expressive:
   petra.comparesScreens(["Berlin", "Munich"])
   // Less expressive:
   petra.selectsMultipleScreens(["Berlin", "Munich"])
   ```

### Guidelines for Decision-Making

**The Expressiveness Rule**: If reusing an existing method makes the test less clear to a domain expert, create a new method.

**The Proliferation Warning**: If you're creating many similar methods (`seesScreen`, `viewsScreen`, `looksAtScreen`, `observesScreen`), you're creating unnecessary complexity. Pick the most domain-appropriate term and stick with it.

**The Real-World Test**: Would a person using physical tools use both terms for different situations, or are they synonyms?

## Test Organization Patterns

### Organizing by Persona

```typescript
test.describe("Given Petra persona", () => {
  // All Petra scenarios
});

test.describe("Given Jakub persona", () => {
  // All Jakub scenarios
});
```

**When to use**: Different users with different needs or mental models

### Organizing by Scenario

```typescript
test.describe("Given multiple screens exist in different cities", () => {
  test.describe("When filtering by location", () => {
    // Location filtering scenarios
  });

  test.describe("When filtering by audience", () => {
    // Audience filtering scenarios
  });
});
```

**When to use**: Same setup, multiple exploration paths

### Combining Preconditions

```typescript
// Multiple preconditions in one describe
test.describe("Given a screen exists at Marienplatz Munich, and Petra looks at Alexanderplatz Berlin", () => {
  test.beforeEach(async () => {
    await sites.existAt(["Marienplatz, Munich"]);
    await petra.looksAt("Alexanderplatz, Berlin");
  });

  test.describe("When Petra looks away from Alexanderplatz to Marienplatz", () => {
    // Test state transition
  });
});
```

**When to use**: Testing state changes or transitions from a specific starting state

## Common Patterns

### Testing Visibility

```typescript
// Item should be visible
await persona.seesScreen("location name")

// Item should not be visible
await persona.doesNotSeeScreen("location name")

// Multiple items visible
await persona.seesScreens(["location1", "location2"])

// Specific count visible
await persona.sees(5, "screens")
```

### Testing State Changes

```typescript
test.describe("Given Petra is looking at Berlin", () => {
  test.beforeEach(async () => {
    await petra.looksAt("Berlin");
  });

  test.describe("When Petra changes to look at Munich", () => {
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

### Testing Data Presence

```typescript
// Setup data that should be found
test.describe("Given screens exist at 3 locations", () => {
  test.beforeEach(async () => {
    await sites.existAt(["Berlin", "Munich", "Hamburg"]);
  });

  test.describe("When viewing the whole region", () => {
    test.beforeEach(async () => {
      await persona.looksAt("Germany");
    });

    test("Then all 3 locations are visible", async () => {
      await persona.seesListedSites(["Berlin", "Munich", "Hamburg"]);
    });
  });
});
```

### Testing Filtering/Narrowing

```typescript
test.describe("Given 10 screens exist across Germany", () => {
  test.beforeEach(async () => {
    await sites.existAt([...allGermanLocations]);
  });

  test.describe("When Jakub wants to see only Berlin screens", () => {
    test.beforeEach(async () => {
      await jakub.looksAt("Berlin");
    });

    test("Then Jakub sees only Berlin locations", async () => {
      await jakub.seesListedSites([...onlyBerlinLocations]);
    });
  });
});
```

## Anti-Patterns to Avoid

### ❌ Implementation Details in Test Names

```typescript
// BAD
test("Then the map state contains the marker", async () => { ... })

// GOOD
test("Then Petra sees the screen on the map", async () => { ... })
```

### ❌ Technical Actions in DSL Methods

```typescript
// BAD
petra.clicksMarker("Berlin")
petra.updatesFilters({ city: "Berlin" })

// GOOD
petra.selectsScreen("Berlin")
petra.wantsToSeeOnly("Berlin")
```

### ❌ Multiple Actions in One Test

```typescript
// BAD - Testing multiple unrelated things
test("Then Petra sees screens and can book them", async () => {
  await petra.seesScreens([...]);
  await petra.booksScreen("Berlin");
})

// GOOD - One assertion per test
test("Then Petra sees available screens", async () => {
  await petra.seesScreens([...]);
})

test("Then Petra can book a screen", async () => {
  await petra.booksScreen("Berlin");
})
```

### ❌ Mixing Given/When/Then Levels

```typescript
// BAD - "When" inside a "Then" test
test("Then when Petra clicks, she sees details", async () => { ... })

// GOOD - Proper nesting
test.describe("When Petra selects a screen", () => {
  test.beforeEach(async () => {
    await petra.selectsScreen("Berlin");
  });

  test("Then Petra sees screen details", async () => {
    await petra.seesDetails("Screen information");
  });
});
```

### ❌ Redundant Describes

```typescript
// BAD - Unnecessary nesting
test.describe("ScreenExplorer", () => {
  test.describe("ScreenExplorer tests", () => {
    test.describe("Testing the ScreenExplorer", () => { ... })
  })
})

// GOOD - Meaningful structure
test.describe("ScreenExplorer", () => {
  test.describe("Given Petra persona", () => {
    test.describe("When viewing Berlin", () => { ... })
  })
})
```

## Summary

1. **Structure**: Use Given-When-Then with nested describes
2. **Naming**: Domain language, not computer language
3. **Reuse**: When semantics match exactly
4. **Create**: When expressiveness demands it
5. **Personas**: Organize tests around user journeys
6. **Assertions**: One clear outcome per test
7. **Real-world test**: Would this make sense without computers?
