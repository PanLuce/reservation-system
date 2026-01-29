---
name: Understand Behavior to Test
description: Analyzes code/requirements to identify externally observable behaviors for testing, focusing on WHAT code does rather than HOW it works internally
---

# Understand Behavior to Test

Your task is to analyze code or requirements and identify the **externally observable behaviors** that should be tested, blocking structure-focused or implementation-focused thinking.

## Context Optimization

**BEFORE READING FILES:**
1. Check if the target file has already been read in this conversation
2. Look for file content with line numbers (e.g., `1→`, `2→`) in recent context
3. If found, reference the existing content instead of re-reading
4. Only read files that are not already in context or need verification

**Indicators of already-read files:**
- File paths followed by numbered code lines
- Previous skill outputs containing the same file
- Test orchestrator output with file content

## Core Principle

Tests must verify **WHAT the code does** (behavior/capabilities), never **HOW it does it** (implementation).

> **🎯 Critical Reminder:** Behavior-focused tests survive refactoring. Implementation-focused tests break with every internal change. Test the contract, not the implementation.

## Analysis Framework

### Step 1: Identify Component Responsibility and Boundaries

**Ask first:** "What is this component's responsibility and where are its boundaries?"

- **Business Logic Component**: Test behavior and outcomes
- **Adapter/Translator**: Test the translation/mapping (which IS its behavior)
- **Coordinator**: Test coordination logic
- **Data Transformer**: Test transformation correctness

**Critical: Identify the component's boundaries:**
- What is the component's INPUT? (user interactions, props, external events)
- What is the component's OUTPUT? (rendered UI, state changes, events emitted)
- Where does this component's responsibility END?

**For UI components that update stores:**
The store state change IS the observable behavior if:
1. That's how other components observe this component's output
2. The component's job is to translate user input into application state
3. The store is the component's boundary/contract with the rest of the app

Testing store state is NOT an implementation detail when the store is the component's output mechanism.

### Step 2: Apply High-Level Thinking

**BLOCK low-level thinking:**
- ❌ "Returns an object with properties X and Y"
- ❌ "Has method Z"
- ❌ "Calls function W"

**ENFORCE high-level thinking:**
- ✅ "Provides capability Z that solves problem W"
- ✅ "Enables workflow X"
- ✅ "Manages state Y and notifies listeners"

**Before identifying any behavior, answer:**
1. What problem does this code solve?
2. Why would someone use this?
3. What workflows/capabilities does it enable?

### Step 3: Identify State Changes (The Three Types)

Behavior is a change in state. Identify which types apply:

1. **System State Change**: Physical/visible changes
   - Map position changes when you call `flyTo()`
   - Form becomes dirty when user types
   - Modal opens when button is clicked

2. **Data State Change**: Application data changes
   - Sites list updates when new data arrives
   - User profile saves to database
   - Cart items increase when product added

3. **Knowledge State Change**: Information becomes available
   - `getCenter()` tells you where the map is positioned
   - `getVisibleSites()` tells you what sites are shown
   - `isLoggedIn()` tells you authentication status

**Key Insight**: Returning information IS behavior when that's what you care about from a high-level perspective.

### Step 4: Apply Observable Behavior Filter

**Ask:** "What is the observable difference from the client's perspective?"

**BLOCK testing non-observable differences:**
- ❌ Whether promise resolves immediately vs after tick (client must await regardless)
- ❌ Whether internal optimization skipped a call (client sees same result)
- ❌ Internal method call order (client sees only final state)

**ENFORCE testing observable differences:**
- ✅ After awaiting, is the system in the expected state?
- ✅ Does calling method X result in observable change Y?
- ✅ Can the client query for information Z?

### Step 5: Fight Implementation Bias

If analyzing existing code, **pretend you don't know the internal implementation**.

**Common implementation bias traps:**
- Testing cleanup because you know there are event handlers
- Testing timing because you know it resolves immediately
- Testing method calls because you know what gets called
- Testing structure because you know what's returned

**Instead focus on:**
- What contract does this expose to clients?
- What capabilities does this enable?
- What guarantees does this provide?

## Output Format

Return a numbered list of behaviors:

```
Component: [Name]
Responsibility: [One sentence describing what problem it solves]

Behaviors:
1. [High-level behavior description]
   - Given: [Starting state/context]
   - When: [Action/trigger]
   - Then: [Observable outcome - what changes or becomes available]

2. [Next behavior]
   ...
```

**Note:** Focus on WHAT the component does, not HOW to test it. The "Then" clause should describe the observable change or capability, not test assertions.

## Red Flags - Auto-Reject

If you catch yourself identifying these as "behaviors to test", STOP and re-analyze:

- ❌ "Returns object with properties X and Y"
- ❌ "Has method Z defined"
- ❌ "Calls method W"
- ❌ "Cleans up event handlers"
- ❌ "Resolves immediately"
- ❌ "Creates instance of X"

## Critical Distinction: When State IS the Behavior

### State as Behavior (Not Implementation Detail)
**State changes ARE the behavior when:**
- The component's PURPOSE is to manage that state for others
- Other components depend on reading that state
- The state IS the component's output/contract
- The component is a coordinator between UI and shared application state

**State is implementation detail when:**
- The state is purely internal for rendering decisions
- The component has other primary outputs (DOM, events, API calls)
- No other component needs to know about this state
- The state mechanism could change without affecting consumers

**Example:** A filter component's job is to collect user selections and make them available to other components via shared state. The state change IS the behavior, not an implementation detail.

## Examples

### ❌ WRONG Analysis
```
Component: useMapboxMap
Behaviors:
- Returns MapComponent and controller
- Controller has flyTo method
- Calls useMapboxController internally
```
**Problem**: All structure/implementation focused

### ✅ RIGHT Analysis
```
Component: useMapboxMap
Responsibility: Provides map visualization with programmatic control

Behaviors to test:
1. Provides bound map visualization and controller
   - Given: Hook is initialized
   - When: MapComponent is rendered and controller.flyTo() is called
   - Then: The rendered map navigates to specified location

2. Controller provides current map state
   - Given: Map is positioned at Berlin
   - When: getCenter() is called
   - Then: Returns Berlin coordinates

3. Map reacts to data changes
   - Given: Map showing 2 sites
   - When: Data updates to include 3rd site
   - Then: Map displays all 3 sites without remounting
```
**Why correct**: Focuses on capabilities, workflows, observable outcomes

### ✅ RIGHT Analysis (Adapter)
```
Component: MapboxController (Adapter)
Responsibility: Translates between app API (lat, lng) and Mapbox API (lng, lat)

Behaviors to test:
1. Translates panTo coordinates correctly
   - Given: Controller is initialized
   - When: panTo(48.8566, 2.3522) is called
   - Then: Mapbox map.panTo is called with [2.3522, 48.8566]

2. Translates flyTo parameters correctly
   - Given: Controller is initialized
   - When: flyTo(52.52, 13.405, 10) is called
   - Then: Mapbox map.flyTo is called with {center: [13.405, 52.52], zoom: 10}
```
**Why correct for adapter**: Translation IS the behavior for adapters

### ✅ RIGHT Analysis (UI Filter Component)
```
Component: FilterControl
Responsibility: Collects user's filter selections and makes them available to the application

Behaviors:
1. Makes user's filter selections available to other components
   - Given: No filters active
   - When: User selects filter options
   - Then: Selected filters become available in shared application state

2. Reflects current filter state visually
   - Given: Various filter states (none, single, multiple)
   - When: Component renders
   - Then: Visual indication of active filters (placeholder text, count, badges)

3. Provides ability to clear all filters
   - Given: Active filters exist
   - When: User triggers clear action
   - Then: All filters removed from shared state
```
**Why correct**: Identified the component's actual responsibility (managing shared filter state) and its observable behaviors (state availability and visual feedback)

## Special Cases

### Components Built on Third-Party Libraries

When analyzing components that wrap library components (Ark UI, Radix, MUI, Headless UI, etc.):

**Core Principle: "Test the delta, not the foundation"**
Only identify behaviors YOU added, not what the library provides.

**How to separate responsibilities:**
1. **Library's behaviors** (DO NOT identify as behaviors to test):
   - Standard UI interactions (dropdown opening, selection toggling)
   - Accessibility features (ARIA attributes, keyboard navigation)
   - Component lifecycle (mounting, unmounting, state management)
   - Visual feedback mechanisms (checkmarks, highlights)

2. **Your component's behaviors** (DO identify as behaviors to test):
   - Custom business logic and rules
   - Integration with your state management
   - Custom display formatting
   - Conditional rendering logic you added
   - Data transformations or mappings

**Example - Venue Type Filter using Ark Select:**
```
What Ark Select provides (don't test):
- Dropdown opens when trigger clicked
- Options can be selected/deselected
- Multi-select toggle behavior
- Checkmarks appear on selected items
- Dropdown stays open during multi-select

What YOUR component provides (test these):
1. Selection count display logic
   - Given: N venue types selected
   - When: Component renders
   - Then: Shows "N venue types" or "Venue Types" placeholder

2. Store synchronization
   - Given: No selections
   - When: User selects venue types
   - Then: Filter store contains selected values

3. Clear functionality
   - Given: Selections exist
   - When: Clear triggered
   - Then: Store emptied and UI reset
```

### Thin Orchestration Layers
If component is just wiring libraries together:
- Don't over-test library details (library has its own tests)
- Focus on: lifecycle, data flow, public API contracts
- Test integration, not every library feature

### Components with Multiple Collaborators
- Test through the public API only
- Let collaborators work together (don't over-mock)
- Focus on end-to-end workflows, not orchestration

## Mandatory Checks Before Output

Before returning behavior list, verify:

1. ✅ Each behavior describes a capability or state change
2. ✅ Each behavior is observable from outside the component
3. ✅ No behaviors test structure, properties, or method existence
4. ✅ No behaviors test internal method calls (unless adapter)
5. ✅ Behaviors match component's responsibility

If any check fails, re-analyze until all pass.
