import { createElement, Fragment, type PropsWithChildren, type ReactNode } from 'react';

type ComponentsMap = Record<string | number, string | React.ComponentType<PropsWithChildren>>;
type ComponentResolver = (
  tag?: string,
) => string | React.ComponentType<PropsWithChildren> | undefined;
type ComponentsProp = ComponentsMap | ComponentResolver;

export function Renderer({ html, components }: { html: string; components: ComponentsProp }) {
  function getComponent(tag?: string) {
    if (typeof components === 'function') return components(tag) ?? tag ?? Fragment;
    return tag && tag in components ? components[tag]! : Fragment;
  }

  let nodeKey = 0;

  function parseNode(input: string) {
    const stack: { tag: string; children: ReactNode[] }[] = [];
    let current: ReactNode[] = [];

    let i = 0;
    while (i < input.length) {
      if (input[i] === '<') {
        const isClosing = input[i + 1] === '/';
        const tagContent = input.slice(i, input.indexOf('>', i) + 1);
        const isSelfClosing = tagContent.endsWith('/>');

        const tagStart = i + (isClosing ? 2 : 1);
        const tagEnd = input.indexOf('>', tagStart);
        const tagName = input.slice(tagStart, tagEnd).replace('/', '').trim();

        i = tagEnd + 1;

        if (isSelfClosing) {
          // Self-closing tag like <1/>
          const Component = getComponent(tagName);
          current.push(createElement(Component, { key: nodeKey++ }));
        } else if (isClosing) {
          // Closing tag like </0>
          const last = stack.pop()!;
          const Component = getComponent(last.tag);
          const element = createElement(Component, { key: nodeKey++ }, ...current);
          current = last.children;
          current.push(element);
        } else {
          // Opening tag like <0>
          stack.push({ tag: tagName, children: current });
          current = [];
        }
      } else {
        let textEnd = input.indexOf('<', i);
        if (textEnd === -1) textEnd = input.length;
        const text = input.slice(i, textEnd);
        current.push(text);
        i = textEnd;
      }
    }

    return current;
  }

  return createElement(Fragment, undefined, ...parseNode(html));
}
