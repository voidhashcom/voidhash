package cli

import (
	"context"
	"errors"
	"sync"
)

// Each runs fn for every item, at most limit at a time, and returns the
// results in the order of items, whatever order they finished in. It is for
// reads that do not depend on each other, such as one lookup per row of a
// table; [Fetch], [Call], [ListAll] and [FetchPage] are safe to call from fn.
// Writes that must apply in order stay in a plain loop.
//
// When a call fails, the context the others run with is cancelled, no
// further item is started, and Each returns the failure of the earliest
// item that failed by itself, with no results.
//
//	builds, err := cli.Each(ctx, paywalls, 8, func(ctx context.Context, paywall api.PaywallJsonEncoding) (cli.List[api.BuildJsonEncoding], error) {
//		return listBuilds(ctx, app, paywall.Id)
//	})
func Each[T, R any](ctx context.Context, items []T, limit int, fn func(ctx context.Context, item T) (R, error)) ([]R, error) {
	results := make([]R, len(items))
	if len(items) == 0 {
		return results, nil
	}
	limit = max(1, min(limit, len(items)))
	each, cancel := context.WithCancel(ctx)
	defer cancel()

	failures := make([]error, len(items))
	indexes := make(chan int)
	var workers sync.WaitGroup
	for range limit {
		workers.Add(1)
		go func() {
			defer workers.Done()
			for index := range indexes {
				result, err := fn(each, items[index])
				if err != nil {
					failures[index] = err
					cancel()
					continue
				}
				results[index] = result
			}
		}()
	}
feed:
	for index := range items {
		select {
		case indexes <- index:
		case <-each.Done():
			break feed
		}
	}
	close(indexes)
	workers.Wait()

	var stopped error
	for _, err := range failures {
		if err == nil {
			continue
		}
		// An item stopped by another's failure reports the cancellation,
		// not what went wrong.
		if errors.Is(err, context.Canceled) && ctx.Err() == nil {
			stopped = err
			continue
		}
		return nil, err
	}
	if stopped != nil {
		return nil, stopped
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return results, nil
}

// Together runs reads of different kinds at the same time and waits for
// all of them, as [Each] does for one kind: each task stores what it read
// in a variable of its caller, and the first failure stops the rest.
//
//	var products cli.List[api.ProductJsonEncoding]
//	var perks cli.List[api.PerkJsonEncoding]
//	err := cli.Together(ctx,
//		func(ctx context.Context) (err error) { products, err = listProducts(ctx); return err },
//		func(ctx context.Context) (err error) { perks, err = listPerks(ctx); return err },
//	)
func Together(ctx context.Context, tasks ...func(ctx context.Context) error) error {
	_, err := Each(ctx, tasks, len(tasks), func(ctx context.Context, task func(ctx context.Context) error) (struct{}, error) {
		return struct{}{}, task(ctx)
	})
	return err
}
