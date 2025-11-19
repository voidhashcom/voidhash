import { Schema } from 'effect';

export class ChangesetDeploymentServiceError extends Schema.TaggedError<ChangesetDeploymentServiceError>()(
  'ChangesetDeploymentServiceError',
  {
    cause: Schema.String
  }
) {}

export const PerkCreateChangeSchema = Schema.Struct({
  changeType: Schema.Literal('create-perk'),
  key: Schema.String,
  payload: Schema.Struct({
    slug: Schema.String,
    name: Schema.String
  })
});

export const PerkUpdateChangeSchema = Schema.Struct({
  changeType: Schema.Literal('update-perk'),
  key: Schema.String,
  payload: Schema.Struct({
    id: Schema.String,
    slug: Schema.String,
    name: Schema.String
  })
});

export const PerkDeleteChangeSchema = Schema.Struct({
  changeType: Schema.Literal('delete-perk'),
  key: Schema.String,
  payload: Schema.Struct({
    id: Schema.String
  })
});

export const ChangeSchema = Schema.Union(
  PerkCreateChangeSchema,
  PerkUpdateChangeSchema,
  PerkDeleteChangeSchema
);

export const ChangesetSchema = Schema.Struct({
  changes: Schema.Array(ChangeSchema)
});

export function sortChangeset(changeset: typeof ChangesetSchema.Type) {
  const sortedChangeTypesByPriority: (typeof ChangeSchema.Type.changeType)[] = [
    'create-perk',
    'update-perk',
    'delete-perk'
  ];

  const sortedChangeset = [...changeset.changes].sort((a, b) => {
    return (
      sortedChangeTypesByPriority.indexOf(a.changeType) -
      sortedChangeTypesByPriority.indexOf(b.changeType)
    );
  });

  return sortedChangeset;
}
