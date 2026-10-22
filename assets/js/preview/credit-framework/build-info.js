/* Hand-maintained release token. Bump on every change that reaches a test or live surface.
   Format: cf-YYYYMMDD-<label>. Tests enforce that the page footer, the app.js script query
   string and the copied/printed report all carry the same token. Not a git SHA: the static
   host does no build-time injection, and a commit cannot know its own hash before it exists. */
export const BUILD_ID = 'cf-20261022-bs1';
export const BUILD_LINE = `Build ${BUILD_ID}`;
