import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { MessageCircleMore } from 'lucide-react';

// fill this with your actual GitHub info, for example:
export const gitConfig = {
  user: 'k0d13',
  repo: 'saykit',
  branch: 'main',
};

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'SayKit',
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
    links: [
      {
        text: 'Community',
        url: 'https://discord.gg/vGFBFf3K2',
        icon: <MessageCircleMore />
      }
    ]
  };
}
