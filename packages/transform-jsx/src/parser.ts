import * as t from '@babel/types';
import {
  ArgumentMessage,
  AUTO_INCREMENT_IDENTIFIER,
  ChoiceMessage,
  CompositeMessage,
  ElementMessage,
  isArgumentType,
  LiteralMessage,
  validateArgumentStyle,
  validateBranchIdentifier,
  type Message,
} from '@saykit/config/messages';
import { getTranslatorComments, unwrapPlaceholder } from '@saykit/transform-js/parser';

/**
 * Attribute used to name the ICU tag an embedded element extracts as, e.g.
 * `<a say-tag="link">` becomes `<link></link>` rather than `<0></0>`. It never
 * reaches the real element.
 */
const TAG_ATTRIBUTE = 'say-tag';

// A tag name is also used as a JSX prop name
const TAG_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseJSXContainerElement(element: t.JSXElement): CompositeMessage | null {
  if (element.openingElement.selfClosing) return null;
  const processed = processJSXOpeningElement(element.openingElement);
  if (!processed) return null;
  const [accessor] = processed;

  const children = buildMessageChildren(element);

  const descriptorId = findAttributeValueIfStringLiteralAsString(
    element.openingElement.attributes,
    'id',
  );
  const descriptorContext = findAttributeValueIfStringLiteralAsString(
    element.openingElement.attributes,
    'context',
  );
  const whitespace = findAttributeValueAsBoolean(element.openingElement.attributes, 'whitespace');

  return new CompositeMessage(
    { id: descriptorId, context: descriptorContext },
    getTranslatorComments(element.leadingComments),
    getReferences(element),
    children,
    accessor as t.Expression,
    whitespace,
  );
}

/**
 * A self-closing `Say` element. Comments are passed in rather than read off the
 * node, since they were written in front of the element as a whole and Babel
 * attaches them there.
 */
export function parseJSXOpeningElement(
  element: t.JSXOpeningElement,
  comments?: readonly t.Comment[] | null,
): CompositeMessage | null {
  if (!element.selfClosing) return null;
  const processed = processJSXOpeningElement(element);
  if (!processed) return null;
  const [accessor, kind] = processed;

  const descriptorId = findAttributeValueIfStringLiteralAsString(element.attributes, 'id');
  const descriptorContext = findAttributeValueIfStringLiteralAsString(
    element.attributes,
    'context',
  );

  const wrap = (children: Message[]) =>
    new CompositeMessage(
      { id: descriptorId, context: descriptorContext },
      getTranslatorComments(comments),
      getReferences(element),
      children,
      accessor as t.Expression,
    );

  if (typeof kind === 'string' && ['select', 'ordinal', 'plural'].includes(kind)) {
    const offset = kind === 'select' ? undefined : findPluralOffset(element.attributes);

    const branches = element.attributes.reduce<{ identifier: string; value: Message }[]>((b, a) => {
      if (!t.isJSXAttribute(a)) return b;

      let identifier = getAttributeNameAsString(a);
      if (identifier === '_' || identifier === 'id' || identifier === 'context') return b;
      // `offset` is a modifier on the selector, not a case to select
      if (offset !== undefined && identifier === 'offset') return b;
      if (
        identifier.startsWith('_') &&
        identifier.length > 1 &&
        !Number.isNaN(+identifier.slice(1))
      )
        identifier = identifier.slice(1);

      if (t.isStringLiteral(a.value)) {
        b.push({ identifier, value: new LiteralMessage(a.value.value) });
      } else if (t.isJSXExpressionContainer(a.value)) {
        if (t.isJSXElement(a.value.expression)) {
          b.push({
            identifier,
            value: parseJSXElement(a.value.expression, true),
          });
        } else if (t.isJSXFragment(a.value.expression)) {
          // A branch is a sentence rather than an element, so a fragment around
          // one is how JSX writes a case that interpolates: `one={<>{n} day</>}`
          // for the `# day` a plain string attribute cannot express
          const fragment = a.value.expression;
          b.push({
            identifier,
            value: new CompositeMessage({}, [], [], buildMessageChildren(fragment), fragment),
          });
        } else if (t.isExpression(a.value.expression)) {
          const [name, value] = unwrapPlaceholder(a.value.expression);
          b.push({ identifier, value: new ArgumentMessage(name, value) });
        }
      }

      return b;
    }, []);

    for (const branch of branches) validateBranchIdentifier(kind, branch.identifier);

    const initialiser = findAttributeValueIfExpressionOrStringLiteral(element.attributes, '_');
    if (!initialiser) return null;
    const [identifier, selector] = unwrapPlaceholder(initialiser);
    return wrap([new ChoiceMessage(kind, identifier, branches, selector, offset)]);
  }

  if (typeof kind === 'string' && isArgumentType(kind)) {
    const initialiser = findAttributeValueIfExpressionOrStringLiteral(element.attributes, '_');
    if (!initialiser) return null;

    const style = findAttributeValueIfStringLiteralAsString(element.attributes, 'style');
    if (style !== undefined) validateArgumentStyle(kind, style);

    const [identifier, value] = unwrapPlaceholder(initialiser);
    return wrap([new ArgumentMessage(identifier, value, { type: kind, style })]);
  }

  return null;
}

/**
 * The `offset` a plural subtracts from its selector before `#` is formatted.
 * See the JS parser's counterpart: the constraints are the same, only the
 * syntax carrying it differs.
 */
function findPluralOffset(attributes: t.JSXOpeningElement['attributes']) {
  for (const attribute of attributes) {
    if (!t.isJSXAttribute(attribute)) continue;
    if (getAttributeNameAsString(attribute) !== 'offset') continue;
    if (!t.isJSXExpressionContainer(attribute.value)) continue;
    const { expression } = attribute.value;
    if (!t.isNumericLiteral(expression)) continue;
    if (!Number.isInteger(expression.value) || expression.value < 0) continue;
    return expression.value;
  }
  return undefined;
}

/**
 * The children the JSX transform itself would compile, so a message extracts as
 * the text that renders. Text children come back with their whitespace
 * collapsed the way JSX collapses it: a line break and its indentation are
 * layout and disappear, while two lines that both hold text rejoin with one
 * space. Expression containers come back unwrapped, and a comment as nothing.
 */
function buildMessageChildren(element: t.JSXElement | t.JSXFragment, into: Message[] = []) {
  return t.react.buildChildren(element).reduce<Message[]>((p, c) => {
    const literal = getExpressionAsLiteralText(c);

    if (literal !== undefined) {
      pushLiteral(p, literal);
    } else if (t.isJSXElement(c)) {
      p.push(parseJSXElement(c, true));
    } else if (t.isJSXFragment(c)) {
      // A fragment renders no element of its own, so it is not a tag a
      // translator could move: its children belong to the sentence around it,
      // and folding them in is what the rendered output already looks like
      buildMessageChildren(c, p);
    } else if (t.isExpression(c)) {
      const [identifier, value] = unwrapPlaceholder(c);
      p.push(new ArgumentMessage(identifier, value));
    }

    return p;
  }, into);
}

/**
 * Add text to the message, folding it into the literal in front of it when
 * there is one, so `Hello{' '}world` is three children in the source and one
 * run of text in the catalogue.
 */
function pushLiteral(messages: Message[], text: string) {
  if (!text) return;

  const last = messages.at(-1);
  if (last instanceof LiteralMessage) {
    messages[messages.length - 1] = new LiteralMessage(last.text + text);
  } else {
    messages.push(new LiteralMessage(text));
  }
}

/**
 * The text a child renders as, when that is knowable at build time: a text
 * child, already collapsed into a string by `buildChildren`, or an expression
 * holding a literal with nothing interpolated into it.
 *
 * The second is what makes `{' '}` the way to write whitespace that has to
 * survive a line break, since it extracts as the space it renders as.
 */
function getExpressionAsLiteralText(expression: t.Node) {
  if (t.isStringLiteral(expression)) return expression.value;
  // A number renders as the text `String()` makes of it, and reads as content
  // in the sentence rather than as a value anything supplies
  if (t.isNumericLiteral(expression)) return String(expression.value);
  // A signed number is a unary operator applied to a literal rather than a
  // literal of its own, but `{-1}` is still a number written into a sentence
  if (
    t.isUnaryExpression(expression) &&
    (expression.operator === '-' || expression.operator === '+') &&
    t.isNumericLiteral(expression.argument)
  ) {
    return String(
      expression.operator === '-' ? -expression.argument.value : expression.argument.value,
    );
  }
  // JSX renders no child at all for these, so the sentence has a gap where the
  // expression is and nothing to put in it
  if (t.isBooleanLiteral(expression) || t.isNullLiteral(expression)) return '';
  // A template literal with nothing interpolated is a string literal written
  // with different quotes, and renders as one
  if (t.isTemplateLiteral(expression) && expression.expressions.length === 0) {
    const [chunk] = expression.quasis;
    // Nothing interpolated means exactly one chunk, and a chunk only fails to
    // cook for an escape that is a syntax error outside a tagged template
    /* v8 ignore next */
    return chunk?.value.cooked ?? '';
  }
  return undefined;
}

function processJSXOpeningElement(element: t.JSXOpeningElement): [t.Node, string | null] | null {
  if (t.isJSXIdentifier(element.name) && element.name.name === 'Say') {
    return [element.name, null];
  }

  if (
    t.isJSXMemberExpression(element.name) &&
    t.isJSXIdentifier(element.name.object) &&
    element.name.object.name === 'Say' &&
    t.isJSXIdentifier(element.name.property)
  ) {
    return [element.name.object, element.name.property.name.toLowerCase()];
  }

  return null;
}

export function parseJSXElement(element: t.JSXElement, fallback?: false): CompositeMessage | null;
export function parseJSXElement(
  element: t.JSXElement,
  fallback: true,
): CompositeMessage | ElementMessage;
export function parseJSXElement(element: t.JSXElement, fallback?: boolean): Message | null {
  const message = element.openingElement.selfClosing
    ? parseJSXOpeningElement(element.openingElement, element.leadingComments)
    : parseJSXContainerElement(element);

  if (message) return message;
  if (!fallback) return null;

  const identifier = takeElementTag(element) ?? AUTO_INCREMENT_IDENTIFIER;

  if (element.openingElement.selfClosing) return new ElementMessage(identifier, [], element);

  const fake = t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier('Say'), []),
    t.jsxClosingElement(t.jsxIdentifier('Say')),
    element.children,
  );
  // `parseJSXElement(fake, true)` always resolves (the synthesised element is a
  // `Say` container), so the wrapped message is never null
  const wrapped = parseJSXElement(fake, true)!;
  return new ElementMessage(identifier, [wrapped], element);
}

/**
 * Read the tag name off an embedded element and remove the attribute so it
 * never reaches the rendered element. Only static strings name a tag; anything
 * else is left in place and the element falls back to an auto-incremented
 * identifier.
 */
function takeElementTag(element: t.JSXElement) {
  const attributes = element.openingElement.attributes;
  const index = attributes.findIndex(
    (a) => t.isJSXAttribute(a) && getAttributeNameAsString(a) === TAG_ATTRIBUTE,
  );
  if (index === -1) return undefined;

  const attribute = attributes[index] as t.JSXAttribute;
  // Both `say-tag="link"` and `say-tag={'link'}` are static; anything else is
  // only known at runtime, too late to name a tag with
  const value = t.isJSXExpressionContainer(attribute.value)
    ? attribute.value.expression
    : attribute.value;
  if (!t.isStringLiteral(value)) return undefined;

  const tag = value.value;
  if (!TAG_PATTERN.test(tag))
    throw new Error(
      `Invalid '${TAG_ATTRIBUTE}' value '${tag}', expected a letter or underscore followed by letters, digits, or underscores`,
    );

  attributes.splice(index, 1);
  return tag;
}

function getReferences(node: t.Node) {
  if (!node.loc?.filename) return [];
  return [`${node.loc.filename}:${node.loc.start.line}`];
}

function getAttributeNameAsString(attribute: t.JSXAttribute) {
  // A JSX attribute name is always an identifier or a namespaced name
  return t.isJSXIdentifier(attribute.name) ? attribute.name.name : attribute.name.name.name;
}

function findAttributeValueIfStringLiteralAsString(
  attributes: (t.JSXAttribute | t.JSXSpreadAttribute)[],
  identifier: string,
) {
  for (const attribute of attributes) {
    if (!t.isJSXAttribute(attribute)) continue;
    if (t.isJSXIdentifier(attribute.name) && attribute.name.name === identifier) {
      if (t.isStringLiteral(attribute.value)) return attribute.value.value;
    }
  }
  return undefined;
}

function findAttributeValueIfExpressionOrStringLiteral(
  attributes: (t.JSXAttribute | t.JSXSpreadAttribute)[],
  identifier: string,
) {
  for (const attribute of attributes) {
    if (!t.isJSXAttribute(attribute)) continue;
    if (t.isJSXIdentifier(attribute.name) && attribute.name.name === identifier) {
      if (t.isJSXExpressionContainer(attribute.value) && t.isExpression(attribute.value.expression))
        return attribute.value.expression;
      if (t.isStringLiteral(attribute.value)) return attribute.value;
    }
  }
  return undefined;
}

function findAttributeValueAsBoolean(
  attributes: (t.JSXAttribute | t.JSXSpreadAttribute)[],
  identifier: string,
) {
  for (const attribute of attributes) {
    if (!t.isJSXAttribute(attribute)) continue;
    if (!t.isJSXIdentifier(attribute.name) || attribute.name.name !== identifier) continue;
    // Bare attribute (e.g. `whitespace`) implies `true`
    if (attribute.value == null) return true;
    if (
      t.isJSXExpressionContainer(attribute.value) &&
      t.isBooleanLiteral(attribute.value.expression)
    )
      return attribute.value.expression.value;
  }
  return undefined;
}
