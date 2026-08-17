import type { StandardSchemaV1 } from "@standard-schema/spec";
import { z } from "zod";

type CollectionSchema<Schema extends StandardSchemaV1, Context> =
  | Schema
  | ((ctx: Context) => Schema);

type MetaCollection<Schema extends StandardSchemaV1 = StandardSchemaV1> = {
  type: "meta";
  dir: string | string[];
  files?: string[];
  schema?: CollectionSchema<
    Schema,
    {
      path: string;
      source: string;
    }
  >;
};

type DocCollection<
  Schema extends StandardSchemaV1 = StandardSchemaV1,
  Async extends boolean = boolean,
> = {
  type: "doc";
  dir: string | string[];
  files?: string[];
  async?: Async;
  postprocess?: {
    includeProcessedMarkdown?: boolean;
  };
  schema?: CollectionSchema<
    Schema,
    {
      path: string;
      source: string;
    }
  >;
};

type DocsCollection<
  DocSchema extends StandardSchemaV1 = StandardSchemaV1,
  MetaSchema extends StandardSchemaV1 = StandardSchemaV1,
  Async extends boolean = boolean,
> = {
  type: "docs";
  dir: string;
  docs: DocCollection<DocSchema, Async>;
  meta: MetaCollection<MetaSchema>;
};

type FumadocsConfig = {
  mdxOptions?: {
    remarkNpmOptions?: {
      persist?: {
        id: string;
      };
    };
    valueToExport?: string[];
    /**
     * Options forwarded to fumadocs' `rehypeCode` (Shiki) plugin. Only `themes`
     * is overridden here; the plugin merges the rest of its defaults (notation
     * transformers, meta parsing). Theme values may be a bundled Shiki theme
     * name or a full TextMate theme object.
     */
    rehypeCodeOptions?: {
      themes?: {
        light?: string | Record<string, unknown>;
        dark?: string | Record<string, unknown>;
      };
    };
  };
};

export const metaSchema = z.object({
  title: z.string().optional(),
  pages: z.array(z.string()).optional(),
  description: z.string().optional(),
  root: z.boolean().optional(),
  defaultOpen: z.boolean().optional(),
  icon: z.string().optional(),
});

export const frontmatterSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  full: z.boolean().optional(),
  _openapi: z.looseObject({}).optional(),
});

export const defineDocs = <
  DocSchema extends StandardSchemaV1 = typeof frontmatterSchema,
  MetaSchema extends StandardSchemaV1 = typeof metaSchema,
  Async extends boolean = false,
>(options: {
  dir?: string;
  docs?: Omit<DocCollection<DocSchema, Async>, "dir" | "type">;
  meta?: Omit<MetaCollection<MetaSchema>, "dir" | "type">;
}): DocsCollection<DocSchema, MetaSchema, Async> => {
  const dir = options.dir ?? "content/docs";

  return {
    type: "docs",
    dir,
    docs: {
      type: "doc",
      dir,
      schema: frontmatterSchema as unknown as CollectionSchema<
        DocSchema,
        {
          path: string;
          source: string;
        }
      >,
      ...options.docs,
    },
    meta: {
      type: "meta",
      dir,
      schema: metaSchema as unknown as CollectionSchema<
        MetaSchema,
        {
          path: string;
          source: string;
        }
      >,
      ...options.meta,
    },
  };
};

export const defineConfig = <T extends FumadocsConfig>(config: T): T => config;
