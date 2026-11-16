<?php

declare(strict_types=1);

namespace Voidhash\Provider;

/** A provider that pages through its past subscriptions and transactions, so Voidhash can import them. */
interface HistorySource
{
    /**
     * Returns one page of the records of `$request->kind` created before
     * `$request->before`: {@see Subscription} items for subscriptions and
     * {@see Transaction} items for transactions. Later records arrive through
     * the push endpoints.
     *
     * @throws ProviderException to fail with a chosen code and message
     */
    public function listHistory(HistoryRequest $request): HistoryPage;
}
