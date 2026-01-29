# Core Testing Philosophy: Domain Language Over Computer Language

## The Golden Rule

**Write tests as if computers don't exist.**

Imagine the persona using a physical tool (like a map atlas, paper form, or catalog) instead of software. What would they DO? What would they SEE? What would they WANT?

## The Litmus Test

Before creating any DSL method name, ask:

> **"Would this make sense if the persona was working with physical objects instead of software?"**

If the answer is no, rethink the method name.

## Examples: Good vs Bad

### ✅ GOOD - Domain Language (Human Actions & Desires)

```typescript
// What Jakub WANTS
jakub.wantsToSeeOnly("high traffic locations")
jakub.isInterestedIn("locations near train stations")

// What Jakub DOES (physical actions)
petra.opensAMap()
petra.looksAt("Alexanderplatz, Berlin")
jakub.looksFor("business districts")

// What Jakub SEES (observations)
petra.seesScreen("Alexanderplatz U-Bahn entrance, Berlin")
petra.doesNotSeeScreen("Marienplatz, Munich")
jakub.seesScreens(["Berlin", "Hamburg", "Munich"])
```

**Why good?** All of these could work with a physical map atlas or paper catalog.

### ❌ BAD - Computer Language (System Mechanisms)

```typescript
// System actions (not persona actions)
jakub.showsOnlyLocations("high traffic")  // ❌ Jakub doesn't "show" - the system shows
jakub.displaysResults()                   // ❌ System mechanism
jakub.rendersMap()                        // ❌ Computer implementation detail

// Computer mechanisms (not human intent)
jakub.filtersBy("audience size")          // ❌ "Filtering" is what computers do
jakub.narrowsDownTo("Berlin")             // ❌ Mechanism, not intent
petra.setsMapViewport(coords)             // ❌ Pure computer concept
petra.clicksOpenMapButton()               // ❌ Implementation detail

// Implementation details (not behavior)
petra.expectsMarkerVisible()              // ❌ Computer UI concept
jakub.checksMapState()                    // ❌ Technical mechanism
sites.callsApiWith(params)                // ❌ Internal implementation
```

**Why bad?** None of these would make sense with physical objects. They reveal computer implementation.

## Common Traps to Avoid

### Trap 1: System Actions Disguised as Persona Actions

❌ `jakub.showsLocations()`
✅ `jakub.wantsToSee("locations in Berlin")`

The system shows things. Jakub wants to see things or looks at things.

### Trap 2: Computer Mechanisms Disguised as Human Actions

❌ `petra.filtersScreensByCity("Berlin")`
✅ `petra.looksForScreensIn("Berlin")`

Humans don't "filter" - they look for things, search for things, focus on things.

### Trap 3: UI Implementation Leaking Into Tests

❌ `petra.clicksOnMarker("Alexanderplatz")`
✅ `petra.selectsScreen("Alexanderplatz")`

With a paper map, Petra might point to, circle, or select a location. Clicking is computer-specific.

### Trap 4: Technical State Instead of Observable Outcome

❌ `petra.expectsMapStateToContain(screens)`
✅ `petra.seesScreens(screens)`

Petra doesn't care about state. She cares about what she can see and observe.

## The Persona Perspective

Always think from the persona's perspective:

- **What does the persona WANT?** (intent)
- **What does the persona DO?** (action)
- **What does the persona SEE?** (observation)
- **What is the persona INTERESTED IN?** (desire)

Never think from the system's perspective:

- How does the system work? ❌
- What API gets called? ❌
- What state changes? ❌
- What UI element is involved? ❌

## Real-World Analogy Test

For every DSL method, imagine explaining it to someone who has never used a computer:

- ✅ "Jakub opens a map" → Makes sense
- ✅ "Jakub looks at Berlin" → Makes sense
- ✅ "Jakub sees three locations" → Makes sense
- ❌ "Jakub filters by criteria" → Confusing
- ❌ "Jakub sets the viewport" → What's a viewport?
- ❌ "Jakub renders the display" → Renders what?

## When Computer Language Is Acceptable

There are rare cases where computer-specific language is unavoidable:

```typescript
// System setup (not persona behavior)
sites.existAt(["Berlin", "Munich"])  // Acceptable - this is test data setup

// Context management (framework level)
context = new TestContext(page, mount)  // Acceptable - this is test infrastructure
```

These are acceptable because they're about **test setup and infrastructure**, not about **persona behavior being tested**.

## Summary

The goal: **Tests that read like a story about a person accomplishing something in the real world.**

The test should be understandable by someone who has never seen the software - they should understand WHAT the person wants to accomplish, even if they don't know HOW the software does it.

**Always challenge yourself:** "Is this how a human would describe it, or how a programmer would describe it?"
