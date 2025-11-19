import { describe, expect, it } from 'vitest';
import { type ChangesetSchema, sortChangeset } from '../src/deploy-changeset';

describe('sortChangeset', () => {
  it('should sort changes by priority: create, update, delete', () => {
    const changeset: typeof ChangesetSchema.Type = {
      changes: [
        {
          changeType: 'delete-perk',
          key: 'delete-1',
          payload: { id: 'perk-1' }
        },
        {
          changeType: 'create-perk',
          key: 'create-1',
          payload: { slug: 'perk-1', name: 'Perk 1' }
        },
        {
          changeType: 'update-perk',
          key: 'update-1',
          payload: { id: 'perk-1', slug: 'perk-1', name: 'Updated Perk 1' }
        }
      ]
    };

    const sorted = sortChangeset(changeset);

    expect(sorted).toHaveLength(3);
    expect(sorted[0]?.changeType).toBe('create-perk');
    expect(sorted[1]?.changeType).toBe('update-perk');
    expect(sorted[2]?.changeType).toBe('delete-perk');
  });

  it('should not mutate the original changeset', () => {
    const changeset: typeof ChangesetSchema.Type = {
      changes: [
        {
          changeType: 'delete-perk',
          key: 'delete-1',
          payload: { id: 'perk-1' }
        },
        {
          changeType: 'create-perk',
          key: 'create-1',
          payload: { slug: 'perk-1', name: 'Perk 1' }
        }
      ]
    };

    const originalOrder = changeset.changes.map((c) => c.changeType);
    sortChangeset(changeset);
    const afterSortOrder = changeset.changes.map((c) => c.changeType);

    expect(originalOrder).toEqual(afterSortOrder);
  });
});
