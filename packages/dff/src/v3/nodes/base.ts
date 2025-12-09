import { s } from '../schema';

/** Parent reference for ordering children */
export const parentRefSchema = s.object({
  id: s.string(),
  /** Fractional index for ordering */
  index: s.string()
});
