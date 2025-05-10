declare module 'react-markdown' {
  import { ReactNode } from 'react';

  export interface Components {
    [key: string]: React.ComponentType<any>;
  }

  export interface ReactMarkdownOptions {
    children: string;
    components?: Components;
    remarkPlugins?: any[];
  }

  const ReactMarkdown: React.FC<ReactMarkdownOptions>;
  export default ReactMarkdown;
}

declare module 'remark-gfm' {
  const remarkGfm: any;
  export default remarkGfm;
} 