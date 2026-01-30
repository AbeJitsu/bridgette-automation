# Test-Driven Development (TDD)

Write tests first. Code second. Always.

## The TDD Cycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│   🔴 RED       Write a failing test that describes desired behavior     │
│       ↓                                                                 │
│   🟢 GREEN     Write minimal code to make the test pass                 │
│       ↓                                                                 │
│   🔄 REFACTOR  Clean up code while keeping tests green                  │
│       ↓                                                                 │
│   (repeat)                                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

## When to Apply TDD

| Scenario | Apply TDD? | Test Type |
|----------|------------|-----------|
| Bug fix | Yes | E2E or unit test that fails with the bug |
| New feature | Yes | Tests for expected behavior |
| Refactoring | Yes | Tests first to ensure behavior preserved |
| New hook/utility | Yes | Unit tests for hook behavior |
| New component | Yes | Accessibility + behavior tests |
| Config changes | Maybe | If behavior changes, test it |

## The Process

### 1. RED: Write the Failing Test

Before writing any implementation code:

```typescript
// Example: Testing a new useEditableContent hook
describe('useEditableContent', () => {
  it('should register content with the provider', () => {
    // Arrange
    const initialContent = { title: 'Test' };

    // Act
    const { result } = renderHook(() =>
      useEditableContent('test-page', initialContent)
    );

    // Assert
    expect(result.current.pageSlug).toBe('test-page');
    expect(result.current.content).toEqual(initialContent);
  });
});
```

Run the test. Watch it fail. This confirms:
- The test is actually testing something
- The feature doesn't exist yet

### 2. GREEN: Write Minimal Code

Write just enough code to make the test pass. No more.

```typescript
// Minimal implementation
export function useEditableContent(slug: string, initialContent: unknown) {
  const { setPageSlug, setPageContent, pageContent } = useInlineEdit();

  useEffect(() => {
    setPageSlug(slug);
    setPageContent(initialContent);
  }, []);

  return { pageSlug: slug, content: pageContent || initialContent };
}
```

Run the test. Watch it pass.

### 3. REFACTOR: Clean Up

Now improve the code while keeping tests green:
- Add memoization
- Handle edge cases
- Improve naming
- Add types

Run tests after each change to ensure nothing breaks.

## Test Types by Location

| Type | Location | Command |
|------|----------|---------|
| E2E (user flows) | `app/e2e/` | `npm run test:e2e` |
| Unit (functions/hooks) | `app/__tests__/` | `npm run test:run` |
| Accessibility | `app/__tests__/components/*.a11y.test.tsx` | `npm run test:a11y` |

## Why TDD Matters

1. **Design tool** - Writing tests first forces you to think about the API
2. **Safety net** - Tests catch regressions immediately
3. **Documentation** - Tests describe what the code should do
4. **Confidence** - Refactor fearlessly with green tests
5. **Bug prevention** - Bugs that exist get tests, so they can't return

## Anti-Patterns to Avoid

❌ **Writing tests after** - Tests become an afterthought, coverage suffers
❌ **Testing implementation** - Test behavior, not internal details
❌ **Skipping the red phase** - If the test doesn't fail first, it might not test anything
❌ **Big steps** - One test, one behavior. Small increments.
❌ **Ignoring failing tests** - Fix them or delete them, never ignore

## Quick Reference

```bash
# Run specific E2E test
SKIP_WEBSERVER=true npx playwright test e2e/my-test.spec.ts --project=e2e-bypass

# Run all E2E tests
npm run test:e2e

# Run unit tests
npm run test:run

# Run accessibility tests
npm run test:a11y

# Run tests in watch mode
npm run test
```

## Example: Full TDD Cycle

```
Task: Create useEditableContent hook

1. RED: Write test for basic registration
   → Run → Fails (hook doesn't exist)

2. GREEN: Create minimal hook
   → Run → Passes

3. RED: Write test for content merging
   → Run → Fails (merging not implemented)

4. GREEN: Add merging logic
   → Run → Passes

5. RED: Write test for memoization (no infinite loops)
   → Run → Fails (not memoized)

6. GREEN: Add useMemo
   → Run → Passes

7. REFACTOR: Clean up, add types, improve naming
   → Run → Still passes

8. Commit: Hook + all tests together
```

---

*"Make it work, make it right, make it fast" — Kent Beck*
