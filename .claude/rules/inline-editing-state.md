# Inline Editing State Synchronization Rule

When editing content through the sidebar, **always keep selection state in sync with page content**.

## The Pattern

The inline editing system has three related states:
1. `pageContent` - The source of truth for all page content
2. `selectedSection.content` - Snapshot of section content when selected
3. `selectedItem.content` - Snapshot of item content when selected

## The Bug Pattern to Avoid

```
User clicks item → selectedItem.content = snapshot of content
User types       → updateField() changes pageContent
                 → BUT selectedItem.content is still the OLD snapshot
                 → Input reads from stale selectedItem.content
                 → User's typing appears to do nothing
```

## The Fix Pattern

In `InlineEditContext.tsx`, the `updateField` function MUST update both:
1. `pageContent` (the source of truth)
2. `selectedSection.content` OR `selectedItem.content` (whichever is being edited)

```typescript
// Update page content
setPageContent(prev => setNestedValue(prev, path, newValue));

// Update selected section content if applicable
if (selectedSection?.sectionKey === sectionKey) {
  setSelectedSection(prev => ({
    ...prev,
    content: setNestedValue(prev.content, fieldPath, newValue),
  }));
}

// Update selected item content if applicable
if (selectedItem?.sectionKey === sectionKey && itemIndex === selectedItem.index) {
  setSelectedItem(prev => ({
    ...prev,
    content: setNestedValue(prev.content, itemFieldPath, newValue),
  }));
}
```

## Path Construction Bug Pattern

When building paths for array items, check if `sectionKey === arrayField`:

```typescript
// WRONG - doubles up the path when sectionKey IS the array
const fullPath = `${arrayField}.${index}.${fieldPath}`;
// Results in "items.items.0.answer" instead of "items.0.answer"

// CORRECT - skip arrayField if it equals sectionKey
const fullPath = (sectionKey === arrayField || arrayField === '')
  ? `${index}.${fieldPath}`
  : `${arrayField}.${index}.${fieldPath}`;
```

## Testing Requirements

When modifying inline editing code, ALWAYS run:
```bash
SKIP_WEBSERVER=true npx playwright test e2e/item-editing.spec.ts --project=e2e-bypass
```

The `item-editing.spec.ts` tests verify that typing in fields actually updates content:
- FAQ question/answer fields
- Pricing tier fields
- Privacy section fields

## Files to Check

When touching inline editing:
- `context/InlineEditContext.tsx` - State management, `updateField` function
- `components/InlineEditor/AdminSidebar.tsx` - Field change handlers
- `lib/content-path-mapper.ts` - Path construction for click-to-edit
