---
name: Choose Mocking Strategy
description: Analyzes test dependencies to determine what should be mocked (external boundaries) vs integrated (internal collaborators) for effective testing
---

# Choose Mocking Strategy

Your task is to analyze dependencies and determine what should be mocked vs. integrated, following the principle of testing real integration while isolating external boundaries.

## Context Optimization

**BEFORE READING FILES:**
1. Check if component and dependency files are already in conversation context
2. Look for file content with line numbers (e.g., `1→`, `2→`)
3. Reference existing content instead of re-reading
4. Note: Test orchestrator or previous skills may have already loaded files

## Core Principle

Mock external boundaries you don't control. Integrate internal collaborators that work together.

## Mocking Decision Framework

### DO Mock (Always)

1. **External APIs** - HTTP endpoints, database connections, file system
   ```typescript
   // ✅ Mock
   vi.mock('node-fetch');
   vi.mock('fs/promises');
   ```

2. **Third-party libraries you don't control** - Mapbox, Leaflet, AWS SDK
   ```typescript
   // ✅ Mock
   vi.mock('mapbox-gl', () => ({
     Map: vi.fn(() => ({
       on: vi.fn(),
       flyTo: vi.fn(),
       // ... minimal mock interface
     }))
   }));
   ```

3. **Slow operations** - Network calls, heavy computation, large file processing
   ```typescript
   // ✅ Mock
   vi.mock('./expensiveCalculation', () => ({
     calculate: vi.fn(() => mockResult)
   }));
   ```

4. **Non-deterministic operations** - Date/time, random values, UUIDs
   ```typescript
   // ✅ Mock
   vi.useFakeTimers();
   vi.setSystemTime(new Date('2024-01-01'));

   vi.spyOn(Math, 'random').mockReturnValue(0.5);
   ```

### DON'T Mock (Integrate Instead)

1. **Internal collaborators that work together**
   ```typescript
   // ❌ DON'T mock
   // vi.mock('./useMapboxController');

   // ✅ Let them work together
   test("controller can navigate", async () => {
     const { controller } = useMapboxMap(); // Real hook
     await controller.flyTo(52, 13); // Real controller
     const sites = await controller.getVisibleSites();
     expect(sites).toContain(expectedSite);
   });
   ```

2. **The system under test itself**
   ```typescript
   // ❌ NEVER mock what you're testing
   // vi.mock('./MyComponent');
   ```

3. **Simple utilities and helpers**
   ```typescript
   // ❌ DON'T mock
   // vi.mock('./formatDate');

   // ✅ Use real implementation
   import { formatDate } from './formatDate';
   ```

4. **Pure functions**
   ```typescript
   // ❌ DON'T mock
   // vi.mock('./calculateTotal');

   // ✅ Test real function
   const total = calculateTotal(items);
   expect(total).toBe(expectedTotal);
   ```

## Analysis Algorithm

```typescript
function decideMockingStrategy(dependency: Dependency): MockStrategy {
  // Check 1: Is it external?
  if (dependency.isExternal()) {
    return {
      shouldMock: true,
      reason: 'External boundary - not under our control',
      mockLevel: 'full'
    };
  }

  // Check 2: Is it slow/non-deterministic?
  if (dependency.isSlow() || dependency.isNonDeterministic()) {
    return {
      shouldMock: true,
      reason: 'Performance or determinism concern',
      mockLevel: 'full'
    };
  }

  // Check 3: Is it the system under test?
  if (dependency.isSystemUnderTest()) {
    return {
      shouldMock: false,
      reason: 'Never mock what you are testing',
      mockLevel: 'none'
    };
  }

  // Check 4: Is it an internal collaborator?
  if (dependency.isInternalCollaborator()) {
    return {
      shouldMock: false,
      reason: 'Test integration with internal collaborators',
      mockLevel: 'none'
    };
  }

  // Check 5: Is it a simple utility/pure function?
  if (dependency.isPureFunction() || dependency.isSimpleUtility()) {
    return {
      shouldMock: false,
      reason: 'Simple logic - test real implementation',
      mockLevel: 'none'
    };
  }

  // Default: Don't mock unless there's a good reason
  return {
    shouldMock: false,
    reason: 'Default to real implementation for better integration testing',
    mockLevel: 'none'
  };
}
```

## Common Scenarios

### Scenario 1: React Hook with Internal Collaborator

```typescript
// useMapboxMap.ts uses useMapboxController internally

// ❌ WRONG - Over-mocking
vi.mock('./useMapboxController', () => ({
  useMapboxController: vi.fn(() => mockController)
}));

test("returns controller", () => {
  const { controller } = useMapboxMap();
  expect(controller).toBe(mockController); // Just tests mock works
});

// ✅ RIGHT - Let them integrate
// Only mock Mapbox library (external boundary)
vi.mock('mapbox-gl');

test("controller can navigate map", async () => {
  const { controller, MapComponent } = useMapboxMap();
  render(<MapComponent />);
  await controller.flyTo(52, 13);
  const center = await controller.getCenter();
  expect(center).toEqual({ latitude: 52, longitude: 13 });
});
```

### Scenario 2: Service with External API

```typescript
// SiteService calls external API

// ✅ RIGHT - Mock external API
vi.mock('node-fetch');

test("fetches sites from API", async () => {
  const mockFetch = vi.mocked(fetch);
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => [{ id: 1, name: 'Site 1' }]
  });

  const service = new SiteService(); // Real service
  const sites = await service.fetchAllSites();

  expect(sites).toHaveLength(1);
  expect(mockFetch).toHaveBeenCalledWith('/api/sites');
});
```

### Scenario 3: Component with Multiple Collaborators

```typescript
// Component uses useMapData, useMapController, useMapSync

// ❌ WRONG - Mock all collaborators
vi.mock('./useMapData');
vi.mock('./useMapController');
vi.mock('./useMapSync');
// Now you're just testing that mocks work together

// ✅ RIGHT - Only mock data source (external boundary)
vi.mock('./api/fetchMapData'); // External API

// Let all internal hooks work together
test("map displays sites from API", async () => {
  const mockFetch = vi.mocked(fetchMapData);
  mockFetch.mockResolvedValue(mockSites);

  render(<MapComponent />);

  // Real hooks integrate, only API is mocked
  await waitFor(() => {
    expect(screen.getByText('Site 1')).toBeInTheDocument();
  });
});
```

### Scenario 4: Adapter/Facade Pattern

```typescript
// MapboxController adapts app API to Mapbox API

// ✅ RIGHT - Mock the library being adapted
vi.mock('mapbox-gl', () => ({
  Map: vi.fn(() => ({
    panTo: vi.fn(),
    flyTo: vi.fn()
  }))
}));

test("translates panTo coordinates", async () => {
  const controller = new MapboxController(mockMap);
  await controller.panTo(48.8566, 2.3522); // App API (lat, lng)

  // Testing translation IS the behavior for adapters
  expect(mockMap.panTo).toHaveBeenCalledWith([2.3522, 48.8566]); // Mapbox API (lng, lat)
});
```

## Mock Implementation Patterns

### Pattern 1: Minimal Mock Interface

Only mock what you actually use:

```typescript
// ❌ WRONG - Over-specified mock
vi.mock('mapbox-gl', () => ({
  Map: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    remove: vi.fn(),
    flyTo: vi.fn(),
    panTo: vi.fn(),
    getCenter: vi.fn(),
    getZoom: vi.fn(),
    getBounds: vi.fn(),
    // ... 50+ methods
  }))
}));

// ✅ RIGHT - Minimal mock
vi.mock('mapbox-gl', () => ({
  Map: vi.fn(() => ({
    on: vi.fn(),
    flyTo: vi.fn(),
    getCenter: vi.fn(() => ({ lat: 52, lng: 13 }))
  }))
}));
```

### Pattern 2: Spy on Methods (When Partial Mock Needed)

```typescript
// When you need real implementation but want to verify calls
const realService = new SiteService();
const spy = vi.spyOn(realService, 'fetchSites');

await realService.process(); // Calls real fetchSites

expect(spy).toHaveBeenCalled(); // Verify it was called
```

### Pattern 3: Factory Functions for Test Data

```typescript
// Hide test data creation
function createTestSite(overrides = {}) {
  return {
    id: 1,
    name: 'Test Site',
    lat: 52.52,
    lng: 13.405,
    ...overrides
  };
}

test("displays site", () => {
  const site = createTestSite({ name: 'Berlin' });
  render(<SiteCard site={site} />);
  expect(screen.getByText('Berlin')).toBeInTheDocument();
});
```

## Special Cases

### Mapbox GL JS (Browser-Dependent Library)

**For unit tests:**
```typescript
// Use testMode: true - no mocking needed!
const map = new mapboxgl.Map({
  container: containerElement,
  testMode: true, // Full API, no rendering
  center: [10.4515, 51.1657],
  zoom: 12
});

// Real Mapbox API works in tests
map.flyTo({ center: [13.405, 52.52], zoom: 10 });
const center = map.getCenter();
expect(center.lat).toBeCloseTo(52.52);
```

**For component tests (Playwright):**
```typescript
// Mock only data source, test real Mapbox + real component
// In playwright.config.ts:
ctViteConfig: {
  resolve: {
    alias: {
      '../../hooks/useMapData': path.resolve(__dirname, 'src/hooks/__mocks__/useMapData.ts')
    }
  }
}

// Test with real browser, real Mapbox, mocked data
```

## Decision Tree

```
Is dependency external (API, DB, third-party lib)?
├─ YES → Mock it
└─ NO → Is it slow or non-deterministic?
        ├─ YES → Mock it
        └─ NO → Is it the system under test?
                ├─ YES → NEVER mock
                └─ NO → Is it an internal collaborator?
                        ├─ YES → DON'T mock (integrate)
                        └─ NO → Is it a pure function/simple utility?
                                ├─ YES → DON'T mock
                                └─ NO → Default: DON'T mock
```

## Output Format

Return mocking strategy for each dependency:

```typescript
interface MockingStrategy {
  dependency: string;
  shouldMock: boolean;
  reason: string;
  mockImplementation?: string; // Code for mock setup
  integrationNote?: string; // How it integrates with other parts
}

{
  dependencies: [
    {
      dependency: 'mapbox-gl',
      shouldMock: true,
      reason: 'Third-party library - external boundary',
      mockImplementation: `
        vi.mock('mapbox-gl', () => ({
          Map: vi.fn(() => ({
            on: vi.fn(),
            flyTo: vi.fn()
          }))
        }));
      `
    },
    {
      dependency: 'useMapboxController',
      shouldMock: false,
      reason: 'Internal collaborator - test integration',
      integrationNote: 'Let it work with useMapboxMap to test real integration'
    },
    {
      dependency: 'fetchSites (API)',
      shouldMock: true,
      reason: 'External HTTP API',
      mockImplementation: `
        vi.mock('./api/fetchSites', () => ({
          fetchSites: vi.fn(() => Promise.resolve(mockSites))
        }));
      `
    }
  ]
}
```

## Mandatory Checks Before Output

Before returning mocking strategy, verify:

1. ✅ External boundaries are mocked
2. ✅ Internal collaborators are NOT mocked
3. ✅ System under test is NEVER mocked
4. ✅ Mock implementations are minimal (only what's used)
5. ✅ Integration points are clearly documented

If any check fails, re-analyze until all pass.
