import * as Option from "effect/Option";
import * as R from "effect/Record";
import * as Schema from "effect/Schema";
import React from "react";

import type { VoidhashClient } from "../../client";
import type { Product, ProductForSlug, ProductsForSlugs } from "../../core/entities/product";
import { clientRunAtom, productsAtom } from "../../core/reactivity/client-state";
import type { ProductSlug } from "../../core/schema/registry";
import type { VoidhashError } from "../../errors";
import { type VoidhashContext, useProviderStatus } from "../components/provider";
import { useAtomValue } from "./use-atom-value";

const encodeSlugs = Schema.encodeSync(Schema.fromJsonString(Schema.Array(Schema.String)));

/** How the products load is going, the same for every `useProducts()`. */
interface ProductsLoad {
  /** The error that stopped the last load, or `null`. */
  // oxlint-disable-next-line effect/prefer-option-over-null -- public hook answer consumed by non-Effect app code.
  readonly error: VoidhashError | null;
  /**
   * `true` while the provider initializes and until the products have
   * loaded; `false` while disabled.
   */
  readonly isLoading: boolean;
  /** Loads the products again. */
  readonly refetch: () => Promise<void>;
}

/** What `useProducts()` answers: every product. */
export interface UseProductsResult extends ProductsLoad {
  /** Every product the store sells this end user, sorted by slug; empty until loaded. */
  readonly products: ReadonlyArray<Product>;
  readonly data: {
    /** Each product by its slug; a slug the store has no product for is absent. */
    readonly bySlug: { readonly [Slug in ProductSlug]?: ProductForSlug<Slug> };
    /** The product a slug names, or `undefined` when the store has none. */
    // oxlint-disable-next-line effect/prefer-option-over-null -- public SDK answer consumed by non-Effect app code.
    readonly get: <Slug extends ProductSlug>(slug: Slug) => ProductForSlug<Slug> | undefined;
    /** Every product, as `products`. */
    readonly toList: () => ReadonlyArray<Product>;
  };
}

/** What `useProducts(slugs)` answers: the products those slugs name, in their order. */
export interface UseProductsBySlugsResult<
  Slugs extends ReadonlyArray<ProductSlug>,
> extends ProductsLoad {
  /**
   * The product of each slug, in the order given: `undefined` until loaded
   * and where the store has none. With generated types each is typed by its
   * slug, so a subscription's slug is a `SubscriptionProduct`.
   */
  readonly products: ProductsForSlugs<Slugs>;
}

export function productsHookFactory(
  client: VoidhashClient,
  vhContext: React.Context<Option.Option<VoidhashContext>>,
) {
  /**
   * The store products of the project, loaded once for every mounted hook
   * and loaded again when the identity changes, a purchase or restore
   * completes (in a flow too), the product definitions change, or the client
   * starts again after `end()`. Without arguments, every product; with
   * slugs, the products they name, in that order:
   *
   * ```ts
   * const { products: [yearly, monthly], isLoading } = voidhash.useProducts(["yearly", "monthly"]);
   * ```
   */
  function useProducts(): UseProductsResult;
  function useProducts<const Slugs extends ReadonlyArray<ProductSlug>>(
    slugs: Slugs,
  ): UseProductsBySlugsResult<Slugs>;
  function useProducts(
    slugs?: ReadonlyArray<ProductSlug>,
  ): UseProductsResult | UseProductsBySlugsResult<ReadonlyArray<ProductSlug>> {
    const status = useProviderStatus(vhContext, "useProducts");
    const registry = client.internal.getAtomRegistry();
    const state = useAtomValue(registry, productsAtom);
    const run = useAtomValue(registry, clientRunAtom);
    const ready = Option.contains(status, "ready");

    // The first hook to mount loads, a mount after a failed load tries again,
    // and so does a new run of the client (`end()` dropped the products); the
    // client keeps the products current from then on.
    React.useEffect(() => {
      if (!ready) return;
      const current = registry.get(productsAtom);
      if (Option.isNone(current.products) && !current.isLoading) void client.getProducts();
    }, [ready, registry, run]);

    const refetch = React.useCallback(async () => {
      await client.getProducts();
    }, []);

    const products = React.useMemo(
      () => Option.getOrElse(state.products, (): ReadonlyArray<Product> => []),
      [state.products],
    );

    // Callers pass an inline array literal, a new identity on every render;
    // the selection follows the slugs it holds.
    const slugsKey = slugs === undefined ? undefined : encodeSlugs(slugs);
    const selected = React.useMemo(
      () => slugs?.map((slug) => products.find((product) => product.slug === slug)),
      // oxlint-disable-next-line react-hooks/exhaustive-deps -- the key is the slugs' content; the array identity changes every render.
      [products, slugsKey],
    );

    const data = React.useMemo(() => {
      const bySlug = R.fromIterableWith(products, (product) => [product.slug, product]);
      // oxlint-disable-next-line effect/prefer-option-over-null -- public SDK answer consumed by non-Effect app code.
      function get<Slug extends ProductSlug>(slug: Slug): ProductForSlug<Slug> | undefined;
      // oxlint-disable-next-line effect/prefer-option-over-null -- public hook answer consumed by non-Effect app code.
      function get(slug: ProductSlug): Product | undefined {
        return bySlug[slug];
      }
      return { bySlug, get, toList: () => products };
    }, [products]);

    const load: ProductsLoad = {
      error: Option.getOrNull(state.error),
      isLoading:
        Option.contains(status, "initializing") ||
        (ready &&
          (state.isLoading || (Option.isNone(state.products) && Option.isNone(state.error)))),
      refetch,
    };
    return selected === undefined ? { ...load, data, products } : { ...load, products: selected };
  }
  return useProducts;
}
