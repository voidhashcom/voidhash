import type { MetaData, PageData, Source } from "fumadocs-core/source";

interface DocEntry<Data extends PageData> {
  readonly base: string;
  (): Promise<
    Record<string, unknown> & {
      readonly default: unknown;
      readonly extractedReferences?: unknown;
      readonly lastModified?: Date;
      readonly _markdown?: string;
      readonly structuredData?: unknown;
      readonly toc?: unknown;
      readonly frontmatter: Data;
    }
  >;
}

interface MetaEntry<Data extends MetaData> {
  readonly base: string;
  (): Promise<Data>;
}

type DocMap<Data extends PageData> = Record<string, DocEntry<Data>>;
type MetaMap<Data extends MetaData> = Record<string, MetaEntry<Data>>;

const fullPath = (base: string, file: string): string =>
  `${base.replace(/\/$/, "")}/${file.replace(/^\.\//, "")}`;

/**
 * Builds a Fumadocs loader source from generated Vite doc and meta maps.
 */
export const createViteSource = async <
  DocOut extends PageData,
  MetaOut extends MetaData,
>(
  doc: DocMap<DocOut>,
  meta: MetaMap<MetaOut>,
): Promise<
  Source<{
    pageData: DocOut;
    metaData: MetaOut;
  }>
> => {
  const pageFiles = Object.entries(doc).map(async ([file, content]) => {
    const entry = await content();
    const path = fullPath(content.base, file);

    return {
      absolutePath: path,
      data: {
        body: entry.default,
        extractedReferences: entry.extractedReferences,
        getText: async () => {
          if (typeof entry._markdown !== "string") {
            throw new Error("Processed Markdown is not available for this page");
          }

          return entry._markdown;
        },
        info: {
          fullPath: path,
          path: file,
        },
        lastModified: entry.lastModified,
        structuredData: entry.structuredData,
        toc: entry.toc,
        _exports: entry,
        ...entry.frontmatter,
      } as DocOut,
      path: file,
      type: "page" as const,
    };
  });

  const metaFiles = Object.entries(meta).map(async ([file, content]) => {
    const path = fullPath(content.base, file);

    return {
      absolutePath: path,
      data: {
        info: {
          fullPath: path,
          path: file,
        },
        ...(await content()),
      },
      path: file,
      type: "meta" as const,
    };
  });

  return {
    files: await Promise.all([...pageFiles, ...metaFiles]),
  };
};
