/**
 * Active-locale command using zustand-commander.
 *
 * The active locale is a browser-local view-time override (like
 * `stateOverrideSelection`): it changes what the canvas renders and where
 * inline edits land, without mutating the document. `null` means the
 * document's default locale — today's behavior.
 */

import { commander } from "../designer-commander";

/**
 * Set the locale being edited/previewed. `null` selects the default locale.
 *
 * Plain (non-undoable): a view concern, not a document write. Switching locale
 * also stops any in-flight inline text editing so a pending edit can't land in
 * the wrong locale (the contentEditable's blur would otherwise dispatch against
 * whichever locale is now active).
 */
export const setActiveLocale = commander.action<{ locale: string | null }>((ctx, params) => {
  ctx.setState({
    activeLocale: params.locale,
    textEditingNodeId: null,
  });
});
