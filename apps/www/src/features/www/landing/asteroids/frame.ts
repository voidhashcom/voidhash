/**
 * Stage shared by the board and the placeholder that stands in for it.
 *
 * Kept in its own module so the section can reserve the board's exact full-screen footprint
 * without importing — and therefore eagerly bundling — the game itself.
 */
export const ASTEROIDS_STAGE_CLASS = "relative h-svh w-full overflow-hidden bg-black";
