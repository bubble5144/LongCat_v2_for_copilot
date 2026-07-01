const REPLACEMENT_CHARACTER = '\uFFFD';
const LONE_SURROGATE_PATTERN = /([\uD800-\uDBFF][\uDC00-\uDFFF])|[\uD800-\uDFFF]/g;

/**
 * Safe JSON.stringify that handles lone surrogates.
 * Identical to ref implementation — no LongCat-specific changes needed.
 */
export function safeStringify(value: unknown): string {
  const json = JSON.stringify(value, (_key, entryValue: unknown) => {
    if (typeof entryValue === 'string') {
      return toWellFormedString(entryValue);
    }
    return entryValue;
  });
  if (json === undefined) {
    throw new TypeError('Value cannot be serialized as JSON');
  }
  return json;
}

function toWellFormedString(value: string): string {
  const toWellFormed = (value as unknown as { toWellFormed?: () => string }).toWellFormed;
  if (typeof toWellFormed === 'function') {
    return toWellFormed.call(value);
  }
  return value.replace(LONE_SURROGATE_PATTERN, (_match: string, pair?: string) =>
    pair ? pair : REPLACEMENT_CHARACTER
  );
}
