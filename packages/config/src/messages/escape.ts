/**
 * Quoting for text that has to survive a message format unchanged.
 *
 * This lives beside the converter rather than in a transform because it belongs
 * to the format being written, not the syntax being read: a literal is the same
 * literal whether it came from a template literal or from JSX.
 */

/**
 * Escape literal text so ICU MessageFormat 1 reads it as the text it is.
 *
 * MF1 escapes with an apostrophe: a run wrapped in one is taken literally, and a
 * doubled apostrophe is a single apostrophe. An apostrophe only opens a quoted
 * run when a character that needs quoting follows it, so `'#'` is a real escape
 * inside a plural and three literal characters anywhere else, which is why
 * `hash` has to be told rather than assumed.
 *
 * @param text Literal text as the author wrote it
 * @param hash Whether `#` stands for a number here, i.e. whether some `plural`
 *   or `ordinal` encloses this text
 */
export function escapeIcuLiteral(text: string, hash = false) {
  return text.replace(/'/gu, "''").replace(hash ? /[{}#]+/gu : /[{}]+/gu, (run) => `'${run}'`);
}
