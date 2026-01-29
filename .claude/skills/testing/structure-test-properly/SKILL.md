---
name: Structure Test Properly
description: Creates well-structured tests using Given/When/Then pattern with code in matching beforeEach blocks for readability and maintainability
---

# Structure Test Properly

Your task is to create well-structured tests using Given/When/Then pattern with code in matching `beforeEach` blocks, enforcing readability and maintainability.

## Context Optimization

**BEFORE READING FILES:**
1. Check if test files and components are already in context
2. Reference existing content from test orchestrator or previous skills
3. Avoid re-reading files that have line-numbered content visible
4. Focus on structuring tests, not re-analyzing code

## Core Principle

The Given/When/Then structure is **sacred and non-negotiable**. Code must be in the matching block's `beforeEach`, NOT in test bodies.

## Mandatory Structure

```typescript
describe("Given [starting state]", () => {
  // Shared variables
  let systemUnderTest;
  let dependencies;

  beforeEach(() => {
    // ✅ ARRANGE: Setup code goes here
    systemUnderTest = createSystem();
    dependencies = setupDependencies();
  });

  describe("When [action happens]", () => {
    beforeEach(() => {
      // ✅ ACT: Action code goes here
      systemUnderTest.doSomething();
    });

    test("Then [observable outcome]", () => {
      // ✅ ASSERT: Only assertions here
      expect(systemUnderTest.state).toBe(expectedState);
    });

    test("Then [another observable outcome]", () => {
      // ✅ ASSERT: Only assertions here
      expect(dependencies.wasNotified()).toBe(true);
    });
  });

  describe("When [different action happens]", () => {
    beforeEach(() => {
      // ✅ ACT: Different action
      systemUnderTest.doSomethingElse();
    });

    test("Then [different outcome]", () => {
      expect(systemUnderTest.state).toBe(otherState);
    });
  });
});
```

## The Three Parts (ALL Mandatory)

### Given (Arrange)
**Purpose**: Establish starting state - you need to know WHERE you started to understand the change

**Rules:**
- Setup code goes in `beforeEach` of Given block
- Declare shared variables at Given scope
- Make starting state explicit and clear
- Can have nested Given blocks for more specific states

**Example:**
```typescript
describe("Given map showing Berlin area with 2 sites visible", () => {
  let controller, MapComponent;

  beforeEach(async () => {
    const { result } = renderHook(() => useMapboxMap());
    controller = result.controller;
    MapComponent = result.MapComponent;
    render(<MapComponent />);
    await controller.flyTo(52.52, 13.405, 12); // Berlin
    await controller.updateData([alexanderplatz, potsdamerPlatz]);
  });

  // When/Then blocks follow...
});
```

### When (Act)
**Purpose**: The IMPORTANT thing that happens - the trigger, the action, the event

**Rules:**
- Action code goes in `beforeEach` of When block
- Describe what happens, not what you expect as result
- Must be nested inside Given block
- Can have multiple When blocks for different actions on same Given state

**Example:**
```typescript
describe("When data changes to include 3rd site", () => {
  beforeEach(async () => {
    await controller.updateData([
      alexanderplatz,
      potsdamerPlatz,
      brandenburgerTor
    ]);
  });

  // Then blocks follow...
});
```

### Then (Assert)
**Purpose**: Verify the observable outcome

**Rules:**
- ONLY assertions in test body
- NO setup, NO actions in test body
- Multiple Then tests allowed for same When
- Each Then tests one aspect of the outcome

**Example:**
```typescript
test("Then map shows 3 sites visible", async () => {
  const visible = await controller.getVisibleSites();
  expect(visible).toHaveLength(3);
  expect(visible.map(s => s.name)).toContain("Brandenburger Tor");
});
```

## Common Violations - Auto-Block

### ❌ VIOLATION: All code in test body
```typescript
test("Then user is logged out", () => {
  const user = loginUser(); // ❌ Arrange in Then
  user.clickLogout();       // ❌ Act in Then
  expect(user.isLoggedOut()).toBe(true); // ✅ Assert (correct place)
});
```

### ✅ CORRECT: Code in matching blocks
```typescript
describe("Given user is logged in", () => {
  let user;

  beforeEach(() => {
    user = loginUser(); // ✅ Arrange in Given
  });

  describe("When user clicks logout", () => {
    beforeEach(() => {
      user.clickLogout(); // ✅ Act in When
    });

    test("Then user is logged out", () => {
      expect(user.isLoggedOut()).toBe(true); // ✅ Assert only
    });
  });
});
```

### ❌ VIOLATION: Missing When block
```typescript
describe("Given map showing Berlin with 2 sites", () => {
  test("Then shows 3 sites after data update", async () => {
    await testMap.updateData([site1, site2, site3]); // ❌ Act in Then
    await testMap.showsVisibleSites([...3 sites]);
  });
});
```

### ✅ CORRECT: All three parts present
```typescript
describe("Given map showing Berlin with 2 sites", () => {
  beforeEach(async () => {
    await testMap.mountWithData([site1, site2]);
  });

  describe("When data changes to include 3rd site", () => {
    beforeEach(async () => {
      await testMap.updateData([site1, site2, site3]);
    });

    test("Then shows 3 sites visible", async () => {
      await testMap.showsVisibleSites([...3 sites]);
    });
  });
});
```

## Clean Test DSL - Hide Implementation

**ENFORCE**: Hide mock setup and implementation details behind intention-revealing methods.

### ❌ WRONG: Exposed implementation
```typescript
describe("When data changes", () => {
  beforeEach(async () => {
    // ❌ Test sees GeoJSON structure
    const data = createGeoJson([
      { name: "Alexanderplatz", lat: 52.5217, lng: 13.4129 }
    ]);

    // ❌ Test sees page.evaluate mechanics
    await page.evaluate((mockData) => {
      (globalThis as any).mockMapData = mockData;
    }, data);

    // ❌ Test sees component update mechanics
    await mountedComponent.update(<MapboxMapTestingWrapper />);
  });

  test("Then shows sites", async () => {
    // ❌ Test sees page.evaluate again
    const sites = await page.evaluate(async () => {
      const controller = (globalThis as any).testMapController;
      return await controller.getVisibleSites();
    });
    expect(sites).toHaveLength(1);
  });
});
```

### ✅ RIGHT: Clean DSL
```typescript
describe("When data changes to include 3rd site", () => {
  beforeEach(async () => {
    // ✅ Intention-revealing method hides all details
    await testMap.updateData([
      { name: "Alexanderplatz", lat: 52.5217, lng: 13.4129 }
    ]);
  });

  test("Then map shows site visible", async () => {
    // ✅ Expressive assertion
    await testMap.showsVisibleSites([
      { name: "Alexanderplatz" }
    ]);
  });
});
```

**Benefits:**
- Tests read like natural language specifications
- Implementation details hidden in helper class
- Easy to change HOW without breaking tests
- Tests focus on WHAT, not HOW

## Test Helper Pattern

Create test helper classes/objects to encapsulate mock setup:

```typescript
class TestMapHelper {
  constructor(private page: Page) {}

  async updateData(sites: Array<{name: string, lat: number, lng: number}>) {
    const data = createGeoJson(sites);
    await this.page.evaluate((mockData) => {
      (globalThis as any).mockMapData = mockData;
    }, data);
    if (this.mountedComponent) {
      await this.mountedComponent.update(<MapboxMapTestingWrapper />);
    }
  }

  async showsVisibleSites(expected: Array<{name: string}>) {
    const visible = await this.page.evaluate(async () => {
      const controller = (globalThis as any).testMapController;
      return await controller.getVisibleSites();
    });
    expect(visible).toHaveLength(expected.length);
    expected.forEach(site => {
      expect(visible.find(s => s.name === site.name)).toBeDefined();
    });
  }
}
```

## Creating Fluent Assertion APIs

**Core Principle**: Tests should read like natural language specifications, not programming exercises.

### The Expressiveness Progression

Tests evolve through three levels of expressiveness:

**Level 1 - Raw Mechanics (Avoid):**
```typescript
const { result } = renderHook(() => useScreenExplorer(), {
  wrapper: createWrapper()
});
expect(result.current.visibleSites).toHaveLength(1);
expect(result.current.visibleSites[0].siteId).toBe("site-1");
```
**Problems**: Exposes React Testing Library internals, uses generic names, shows array mechanics

**Level 2 - Hidden Mechanics (Better):**
```typescript
const screenExplorer = renderScreenExplorer();
expect(screenExplorer.visibleSites).toHaveLength(1);
expect(screenExplorer.visibleSites[0].siteId).toBe("site-1");
```
**Improvements**: Hides wrapper details, uses domain name, but still shows test mechanics

**Level 3 - Fluent API (Best):**
```typescript
const screenExplorer = renderScreenExplorer();
assertThat(screenExplorer).hasVisibleSiteCount(1);
assertThat(screenExplorer).hasVisibleSite("site-1");
```
**Benefits**: Reads like English, hides all mechanics, uses domain language

### Building a Fluent Assertion API

Create an `assertThat()` function that returns domain-specific assertion methods:

```typescript
function assertThat(screenExplorer: ScreenExplorer) {
  return {
    hasVisibleSiteCount(count: number) {
      expect(screenExplorer.visibleSites).toHaveLength(count);
    },

    hasNoVisibleSites() {
      expect(screenExplorer.visibleSites).toEqual([]);
    },

    hasVisibleSite(siteId: string) {
      const site = screenExplorer.visibleSites.find(s => s.siteId === siteId);
      expect(site).toBeDefined();
      return {
        // Chainable!
        withName(siteName: string) {
          expect(site?.siteName).toBe(siteName);
        },
      };
    },

    hasVisibleSitesInOrder(...siteIds: string[]) {
      expect(screenExplorer.visibleSites).toHaveLength(siteIds.length);
      siteIds.forEach((siteId, index) => {
        expect(screenExplorer.visibleSites[index].siteId).toBe(siteId);
      });
    },
  };
}
```

### When to Invest in Fluent APIs

Create fluent assertions when:
- ✅ Assertions repeat across multiple tests (DRY principle)
- ✅ Test becomes hard to read due to mechanics
- ✅ Domain concepts get lost in test syntax
- ✅ Multiple related assertions usually occur together
- ✅ Chainable assertions add clarity (e.g., `.hasUser("john").withRole("admin")`)

Don't create them when:
- ❌ Assertion only used once or twice
- ❌ Standard expect already clear enough
- ❌ Would add complexity without clarity gain

### Domain Language Over Test Language

**ENFORCE**: Use terminology from your domain, not from testing frameworks.

**❌ Test Language (Avoid):**
```typescript
expect(result.current.visibleSites).toHaveLength(0);
expect(result.current.visibleSites).toEqual([]);
expect(Array.isArray(result.current.visibleSites)).toBe(true);
```

**✅ Domain Language (Use):**
```typescript
assertThat(screenExplorer).hasNoVisibleSites();
assertThat(screenExplorer).hasValidArrayOfVisibleSites();
assertThat(screenExplorer).showsEmptyState();
```

**More Examples:**

| Test Language | Domain Language |
|--------------|-----------------|
| `expect(data).toBeNull()` | `assertThat(component).hasNullMapData()` |
| `expect(items.length).toBe(3)` | `assertThat(cart).hasItemCount(3)` |
| `expect(user.loggedIn).toBe(true)` | `assertThat(session).isAuthenticated()` |
| `expect(form.dirty).toBe(false)` | `assertThat(form).isPristine()` |

### Chainable Assertions for Expressiveness

Support method chaining for related assertions:

```typescript
assertThat(screenExplorer)
  .hasVisibleSite("site-1")
    .withName("Alexanderplatz")
    .withScreenCount(2);

assertThat(user)
  .hasRole("admin")
    .withPermissions(["read", "write", "delete"]);

assertThat(form)
  .hasField("email")
    .withValue("test@example.com")
    .withoutErrors();
```

**Benefits:**
- Reads like natural language sentences
- Groups related assertions logically
- Reduces repetitive expect() calls
- Makes test intent crystal clear

## Tests as Living Documentation

**Core Principle**: Anyone should be able to understand what the system does by reading the tests, without looking at implementation code.

### Why This Matters

**Tests are documentation that:**
- ✅ Never goes out of date (they run constantly)
- ✅ Prove the documentation is accurate
- ✅ Show actual usage examples
- ✅ Are readable by non-technical stakeholders
- ✅ Serve as regression protection

**Traditional documentation:**
- ❌ Often becomes outdated
- ❌ Requires manual updates
- ❌ Can't prove accuracy
- ❌ Separate from the code

### Writing Self-Documenting Tests

**❌ Implementation-Focused (Not Documentation):**
```typescript
test("updates state correctly", () => {
  const { result } = renderHook(() => useHook());
  act(() => { result.current.fn(); });
  expect(result.current.data).toEqual(expected);
});
```
**Problem**: Only developers understand this. What does the hook DO?

**✅ Behavior-Focused (Living Documentation):**
```typescript
describe("Given user has selected multiple filters", () => {
  beforeEach(() => {
    filterStore.setFilters(["dining", "shopping"]);
  });

  describe("When user clears all filters", () => {
    beforeEach(() => {
      userInterface.clickClearFilters();
    });

    test("Then all filters are removed", () => {
      assertThat(filterStore).hasNoActiveFilters();
    });

    test("Then all items are visible again", () => {
      assertThat(itemList).showsAllItems();
    });
  });
});
```
**Benefits**: Product managers, QA, and developers all understand this.

### Making Tests Scannable

**Use clear structure and naming:**
- Given blocks describe business state, not technical setup
- When blocks describe user actions, not method calls
- Then tests describe business outcomes, not state properties

**✅ Scannable Example:**
```
✓ Given user has items in cart
  ✓ When user proceeds to checkout
    ✓ Then checkout page is displayed
    ✓ Then cart total includes all items
    ✓ Then shipping options are available
```

Anyone reading this test output understands the checkout flow.

## Helper Functions for Expressiveness

**Core Principle**: Extract recurring patterns into intention-revealing functions that use domain language.

### Types of Helper Functions

**1. Setup Helpers** (Already covered in "Test Helper Pattern")
- Hide mock/data setup complexity
- Example: `createTestUser()`, `setupMapWithSites()`

**2. Render Helpers** (NEW - Hide testing mechanics)
```typescript
// ❌ Without helper - exposes React Testing Library details
const { result } = renderHook(() => useScreenExplorer(), {
  wrapper: createWrapper(),
});

// ✅ With helper - hides mechanics, reveals intent
const screenExplorer = renderScreenExplorer();
```

**3. Assertion Helpers** (NEW - Create fluent DSL)
```typescript
// ❌ Without helper - generic test language
expect(screenExplorer.visibleSites).toHaveLength(1);
expect(screenExplorer.visibleSites[0].siteId).toBe("site-1");

// ✅ With helper - domain-specific language
assertThat(screenExplorer).hasVisibleSiteCount(1);
assertThat(screenExplorer).hasVisibleSite("site-1");
```

**4. Action Helpers** (Hide interaction complexity)
```typescript
// ❌ Without helper - exposes implementation
await userEvent.click(screen.getByRole("button", { name: /add to cart/i }));
await waitFor(() => expect(screen.getByText(/added/i)).toBeInTheDocument());

// ✅ With helper - reveals business intent
await userActions.addToCart(product);
await userInterface.showsSuccessMessage("Added to cart");
```

### Investment Strategy

**Invest time in helpers when you notice:**
1. **Repetition**: Same pattern used 3+ times
2. **Complexity**: More than 3 lines for a single concept
3. **Confusion**: Other devs ask "what does this do?"
4. **Mechanics exposure**: Testing library details visible in tests
5. **Poor readability**: Can't understand test at a glance

**Don't create helpers for:**
- One-off assertions
- Already-clear standard expects
- Trivial operations that add no clarity

### Real-World Example: Screen Explorer Tests

**Before - Mechanical and repetitive:**
```typescript
test("Then returns array with one MapItem for site-1", () => {
  const { result } = renderHook(() => useScreenExplorer(), {
    wrapper: createWrapper(),
  });

  expect(result.current.visibleSites).toHaveLength(1);
  expect(result.current.visibleSites[0].siteId).toBe("site-1");
  expect(result.current.visibleSites[0].siteName).toBe("Alexanderplatz");
});
```

**After - Expressive and clear:**
```typescript
test("Then returns array with one MapItem for site-1", () => {
  const screenExplorer = renderScreenExplorer();

  assertThat(screenExplorer).hasVisibleSiteCount(1);
  assertThat(screenExplorer).hasVisibleSite("site-1").withName("Alexanderplatz");
});
```

**Improvements:**
- 6 lines → 4 lines (33% reduction)
- Hides React Testing Library mechanics
- Uses domain terminology
- Reads like a specification
- Chainable assertions group related checks

## Naming Conventions

**Given blocks:**
- Start with "Given"
- Describe the starting STATE, not what you did to get there
- ✅ "Given map showing Berlin area with 2 sites"
- ❌ "Given I initialized the map and added sites"

**When blocks:**
- Start with "When"
- Describe the ACTION/EVENT, not the expected result
- ✅ "When data changes to include 3rd site"
- ❌ "When data changes then map shows 3 sites"

**Then tests:**
- Start with "Then"
- Describe the OBSERVABLE OUTCOME
- ✅ "Then map shows 3 sites visible"
- ❌ "Then it works correctly"

## Mandatory Checks Before Output

Before generating test structure, verify:

1. ✅ All three parts (Given/When/Then) are present
2. ✅ Setup code is in Given's beforeEach
3. ✅ Action code is in When's beforeEach
4. ✅ ONLY assertions are in Then test body
5. ✅ Mock details are hidden behind helper methods
6. ✅ Names describe state/action/outcome, not implementation

If any check fails, restructure until all pass.

## Output Format

Generate complete test structure:

```typescript
describe("Given [clear starting state]", () => {
  let [shared variables];

  beforeEach(() => {
    // Setup code
  });

  describe("When [clear action]", () => {
    beforeEach(() => {
      // Action code
    });

    test("Then [observable outcome]", () => {
      // Only assertions
    });
  });
});
```
