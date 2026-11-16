<?php

declare(strict_types=1);

namespace Voidhash\Provider;

/** A provider that refunds charges when Voidhash asks it to. */
interface TransactionRefunds
{
    /**
     * Refunds the charge at the provider and returns the refund transaction,
     * with `type` {@see TransactionType::Refund} and `refundsTransactionId`
     * naming the charge. Voidhash records it as if the provider had reported
     * it, so reporting it again later under the same id changes nothing.
     *
     * @throws ProviderException to fail with a chosen code and message
     */
    public function refundTransaction(RefundTransactionRequest $request): Transaction;
}
