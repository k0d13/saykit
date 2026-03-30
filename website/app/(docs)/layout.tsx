import { DocsLayout, DocsLayoutProps } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from 'lib/layout.shared';
import { source } from 'lib/source';
import { Metadata } from 'next';

function docsOptions(): DocsLayoutProps {
  return {
    ...baseOptions(),
    tree: source.getPageTree(),
  };
}

export default function Layout({ children }: LayoutProps<'/'>) {
  return <DocsLayout {...docsOptions()}>{children}</DocsLayout>;
}

export const metadata: Metadata = {
  title: {
    template: '%s - SayKit',
    default: 'SayKit',
  },
};
