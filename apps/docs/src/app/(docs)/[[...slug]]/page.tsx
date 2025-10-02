import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { Callout } from 'fumadocs-ui/components/callout';
import { File, Files, Folder } from 'fumadocs-ui/components/files';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { notFound, redirect } from 'next/navigation';
import { source } from '@/lib/source';
import { getMDXComponents } from '@/mdx-components';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle
} from '../../../components/layout/page';

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  if (!params.slug || params.slug.length === 0) {
    return redirect('/introduction');
  }
  const slug = params.slug;
  const page = source.getPage(slug);
  if (!page) {
    notFound();
  }

  const MDXContent = page.data.body;

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDXContent
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
            Step,
            Steps,
            File,
            Folder,
            Files,
            Tab,
            Tabs,
            TypeTable,
            Accordion,
            Accordions,
            Callout: ({
              children,
              type,
              ...props
            }: {
              children: React.ReactNode;
              type?: 'info' | 'warn' | 'error' | 'success' | 'warning';
              // biome-ignore lint/suspicious/noExplicitAny: Okay for now. Maybe we can fix this later but those are just props.
              [key: string]: any;
            }) => (
              <Callout type={type} {...props}>
                {children}
              </Callout>
            ),
            iframe: (props) => (
              <iframe {...props} className="h-[500px] w-full" />
            )
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    notFound();
  }

  return {
    title: page.data.title,
    description: page.data.description
  };
}
