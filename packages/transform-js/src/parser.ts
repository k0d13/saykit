import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import {
  ArgumentMessage,
  ChoiceMessage,
  CompositeMessage,
  AUTO_INCREMENT_IDENTIFIER,
  isArgumentType,
  LiteralMessage,
  validateArgumentStyle,
  validateBranchIdentifier,
  type Message,
} from '@saykit/config/messages';

// A placeholder name is also used as a property name in the compiled call
const PLACEHOLDER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseTaggedTemplateExpression(
  tagged: t.TaggedTemplateExpression,
): CompositeMessage | null {
  const processed = processExpression(tagged.tag);
  if (!processed) return null;
  const [accessor, descriptor] = processed;

  const children = buildTemplateChildren(tagged.quasi);

  const descriptorId = descriptor
    ? findPropertyValueIfStringLiteralAsString(descriptor, 'id')
    : undefined;
  const descriptorContext = descriptor
    ? findPropertyValueIfStringLiteralAsString(descriptor, 'context')
    : undefined;

  return new CompositeMessage(
    { id: descriptorId, context: descriptorContext },
    getTranslatorComments(tagged.leadingComments),
    tagged.loc ? [`${tagged.loc.filename}:${tagged.loc.start.line}`] : [],
    children,
    accessor,
  );
}

/**
 * The text and the values of a template literal, in the order they were
 * written: the message the template spells out.
 */
function buildTemplateChildren(template: t.TemplateLiteral) {
  return template.quasis.reduce<Message[]>((c, q, i) => {
    c.push(new LiteralMessage(q.value.cooked ?? q.value.raw));
    if (t.isExpression(template.expressions[i]))
      c.push(parseExpression(template.expressions[i]!, true)!);
    return c;
  }, []);
}

export function parseCallExpression(call: t.CallExpression): CompositeMessage | null {
  const processed = processExpression(call.callee);
  if (!processed) return null;
  const [accessor, descriptor, kind] = processed;

  const descriptorId = descriptor
    ? findPropertyValueIfStringLiteralAsString(descriptor, 'id')
    : undefined;
  const descriptorContext = descriptor
    ? findPropertyValueIfStringLiteralAsString(descriptor, 'context')
    : undefined;

  const wrap = (children: Message[]) =>
    new CompositeMessage(
      { id: descriptorId, context: descriptorContext },
      getTranslatorComments(call.leadingComments),
      call.loc ? [`${call.loc.filename}:${call.loc.start.line}`] : [],
      children,
      accessor,
    );

  if (typeof kind === 'string' && ['select', 'ordinal', 'plural'].includes(kind)) {
    if (call.arguments.length !== 2) return null;
    if (!t.isExpression(call.arguments[0])) return null;
    if (!t.isObjectExpression(call.arguments[1])) return null;
    const object = call.arguments[1];

    const offset = kind === 'select' ? undefined : findPluralOffset(object);

    const branches = object.properties.reduce<ChoiceMessage['branches']>((c, p) => {
      if (!t.isObjectProperty(p) || !t.isExpression(p.value)) return c;
      // `offset` is a modifier on the selector, not a case to select
      if (offset !== undefined && getPropertyNameAsString(p.key) === 'offset') return c;

      let message: Message | null = null;
      if (!message && t.isStringLiteral(p.value)) message = new LiteralMessage(p.value.value);
      // A branch is a sentence rather than a value, so an untagged template
      // spells one out: `one: \`${n} day\`` for the `# day` a plain string
      // cannot express
      if (!message && t.isTemplateLiteral(p.value))
        message = new CompositeMessage({}, [], [], buildTemplateChildren(p.value), p.value);
      if (!message) message = parseExpression(p.value, true);
      c.push({
        identifier: getPropertyNameAsString(p.key),
        value: message!,
      });

      return c;
    }, []);

    for (const branch of branches) validateBranchIdentifier(kind, branch.identifier);

    const [identifier, value] = unwrapPlaceholder(call.arguments[0]);
    return wrap([new ChoiceMessage(kind, identifier, branches, value, offset)]);
  }

  if (typeof kind === 'string' && isArgumentType(kind)) {
    // The options object is optional: `{n, number}` is the type's own default
    // formatting, and is the common case
    if (call.arguments.length < 1 || call.arguments.length > 2) return null;
    if (!t.isExpression(call.arguments[0])) return null;

    let style: string | undefined;
    if (call.arguments.length === 2) {
      if (!t.isObjectExpression(call.arguments[1])) return null;
      style = findPropertyValueIfStringLiteralAsString(call.arguments[1], 'style');
      if (style !== undefined) validateArgumentStyle(kind, style);
    }

    const [identifier, value] = unwrapPlaceholder(call.arguments[0]);
    return wrap([new ArgumentMessage(identifier, value, { type: kind, style })]);
  }

  return null;
}

/**
 * The `offset` a plural subtracts from its selector before `#` is formatted, so
 * "You and 2 others" can select on a total of three.
 *
 * Read only from an integer literal: the offset is baked into the extracted
 * message, and ICU accepts neither a fractional nor a negative one. Anything
 * else stays an ordinary branch.
 */
function findPluralOffset(object: t.ObjectExpression) {
  for (const property of object.properties) {
    if (!t.isObjectProperty(property) || property.computed) continue;
    if (getPropertyNameAsString(property.key) !== 'offset') continue;
    if (!t.isNumericLiteral(property.value)) continue;
    if (!Number.isInteger(property.value.value) || property.value.value < 0) continue;
    return property.value.value;
  }
  return undefined;
}

//

export function processExpression(
  expression: t.Node,
): [t.Expression, t.ObjectExpression | null, string | null] | null {
  if (t.isIdentifier(expression) && expression.name === 'say') {
    return [expression, null, null];
  }

  if (t.isCallExpression(expression)) {
    const inner = processExpression(expression.callee);

    if (
      inner &&
      expression.arguments.length === 1 &&
      t.isObjectExpression(expression.arguments[0])
    ) {
      return [inner[0], expression.arguments[0], null];
    } else if (inner) {
      return [inner[0], null, null];
    }
  }

  if (t.isMemberExpression(expression)) {
    const innerProperty = processExpression(expression.property);
    if (innerProperty) return [expression, innerProperty[1], null];
    const innerObject = processExpression(expression.object);
    if (innerObject && t.isIdentifier(expression.property))
      return [innerObject[0], innerObject[1], expression.property.name];
  }

  return null;
}

function getExpressionAsKey(node: t.Node) {
  if (t.isIdentifier(node)) return node.name;
  // JSX identifiers never reach this JS-only parser, being rejected upstream as
  // non-expression call arguments, but the guard mirrors the JSX parser
  /* v8 ignore next */
  if (t.isJSXIdentifier(node)) return node.name;
  return AUTO_INCREMENT_IDENTIFIER;
}

/**
 * Read the name off a value written as a single-key object and hand back the
 * value alone, so the wrapper never reaches the output: `${{ total: sum() }}`
 * is `{total}` rather than `{0}`.
 *
 * An inline one-key object is the only shape this claims, and it could not mean
 * anything else: interpolating an object stringifies it to `[object Object]`.
 * Anything else is returned untouched.
 */
export function unwrapPlaceholder(
  expression: t.Expression,
): [string | typeof AUTO_INCREMENT_IDENTIFIER, t.Expression] {
  if (!t.isObjectExpression(expression) || expression.properties.length !== 1)
    return [getExpressionAsKey(expression), expression];

  const [property] = expression.properties;
  // A computed key is only known at runtime, too late to name a placeholder
  // with, and a method has no value to interpolate
  if (!t.isObjectProperty(property) || property.computed || !t.isExpression(property.value))
    return [getExpressionAsKey(expression), expression];

  const name = getPropertyNameAsString(property.key);
  // A key that is not computed is always an identifier or a literal, so it
  // always reads back as a string
  /* v8 ignore next */
  if (typeof name !== 'string') return [getExpressionAsKey(expression), expression];

  if (!PLACEHOLDER_PATTERN.test(name))
    throw new Error(
      `Invalid placeholder name '${name}', expected a letter or underscore followed by letters, digits, or underscores`,
    );

  return [name, property.value];
}

/**
 * Whether two placeholders sharing a name are the same placeholder, and so
 * compile to one prop a translator can move around the sentence freely.
 *
 * A value is compared whole: the same variable interpolated twice is one value,
 * while `${name}` beside `${{ name: author.name }}` is two things claiming one
 * name. An element is compared on its opening element alone, since its children
 * come from the translation rather than the source.
 */
export function isEquivalentPlaceholder(a: any, b: any) {
  if (t.isJSXElement(a) || t.isJSXElement(b)) {
    if (!t.isJSXElement(a) || !t.isJSXElement(b)) return false;
    return t.isNodesEquivalent(a.openingElement, b.openingElement);
  }
  if (!t.isNode(a) || !t.isNode(b)) return false;
  return t.isNodesEquivalent(a, b);
}

export function parseExpression(
  expression: t.Expression,
  fallback?: false,
): CompositeMessage | null;
export function parseExpression(
  expression: t.Expression,
  fallback: true,
): CompositeMessage | ArgumentMessage;
export function parseExpression(expression: t.Expression, fallback?: boolean) {
  let message: CompositeMessage | null = null;
  switch (true) {
    case t.isTaggedTemplateExpression(expression):
      message = parseTaggedTemplateExpression(expression);
      break;
    case t.isCallExpression(expression):
      message = parseCallExpression(expression);
      break;
  }

  if (message) {
    return message;
  } else if (fallback) {
    const [key, value] = unwrapPlaceholder(expression);
    // A named `say` macro is still a message of its own, and emitting it as a
    // value would ship a macro the transform never replaced
    if (value !== expression) {
      const nested = parseExpression(value);
      if (nested) return nested;
    }
    return new ArgumentMessage(key, value);
  } else {
    return null;
  }
}

//

function getPropertyNameAsString(key: t.ObjectProperty['key']) {
  if (t.isIdentifier(key)) return key.name;
  if (t.isStringLiteral(key)) return key.value;
  if (t.isNumericLiteral(key)) return key.value.toString();
  if (t.isBigIntLiteral(key)) return key.value.toString();
  return AUTO_INCREMENT_IDENTIFIER;
}

function findPropertyValueIfStringLiteralAsString(object: t.ObjectExpression, key: string) {
  for (const property of object.properties) {
    if (!t.isObjectProperty(property)) continue;
    if (
      t.isIdentifier(property.key) &&
      property.key.name === key &&
      t.isStringLiteral(property.value)
    )
      return property.value.value;
  }
  return undefined;
}

const TRANSLATOR_COMMENT_PREFIX = 'translators:';

/**
 * The notes a translator is meant to read, taken from the comments above a
 * message: `// TRANSLATORS: keep this under 20 characters`. A comment without
 * the marker is a note to whoever is reading the code, and stays there.
 */
export function getTranslatorComments(comments: readonly t.Comment[] | null | undefined) {
  return (comments ?? []).reduce<string[]>((a, c) => {
    const text = c.value.trim();
    if (text.toLowerCase().startsWith(TRANSLATOR_COMMENT_PREFIX))
      a.push(text.slice(TRANSLATOR_COMMENT_PREFIX.length).trim());
    return a;
  }, []);
}

/**
 * The comments written in front of a message, in the order they were written.
 *
 * Babel attaches a comment on its own line to whatever node begins at it, so a
 * message is rarely the node holding its own notes. Walking out to the
 * statement gathers them from wherever they landed.
 */
export function collectLeadingComments(path: NodePath<t.Node>) {
  const levels: (readonly t.Comment[])[] = [];
  let current: NodePath<t.Node> | null = path;

  while (current) {
    levels.push(current.node.leadingComments ?? []);

    const parent: NodePath<t.Node> | null = current.parentPath;
    // Only a program has nothing around it, and a program is not a message
    /* v8 ignore next */
    if (!parent) break;

    // Among JSX children a comment is written as `{/* … */}`, an element of the
    // list rather than something attached to the element it describes
    if (t.isJSXElement(parent.node) || t.isJSXFragment(parent.node)) {
      levels.push(getPrecedingJSXComments(parent.node, current.node));
      break;
    }

    // A statement is the widest thing a comment above a message can belong to,
    // since anything further out wraps code the message is only one part of. An
    // export is the exception, being a wrapper around the statement itself
    if (t.isStatement(current.node) && !t.isExportDeclaration(parent.node)) break;

    current = parent;
  }

  // Innermost first on the way up, and outermost first in the source. A comment
  // that landed on an ancestor is also reachable through a descendant whose own
  // list this traversal already filled in, so identity dedupes the overlap
  return [...new Set(levels.reverse().flat())];
}

/**
 * The comments in the `{/* … *\/}` children standing immediately in front of an
 * element, which is how a comment about a message is written inside JSX. Only
 * the whitespace that lays the markup out may come between them.
 */
function getPrecedingJSXComments(parent: t.JSXElement | t.JSXFragment, node: t.Node) {
  const index = parent.children.indexOf(node as t.JSXElement);
  /* v8 ignore next */
  if (index === -1) return [];

  const comments: t.Comment[] = [];
  for (let i = index - 1; i >= 0; i--) {
    const sibling = parent.children[i]!;
    if (t.isJSXText(sibling) && !sibling.value.trim()) continue;
    if (!t.isJSXExpressionContainer(sibling) || !t.isJSXEmptyExpression(sibling.expression)) break;
    comments.unshift(...(sibling.expression.innerComments ?? []));
  }
  return comments;
}
