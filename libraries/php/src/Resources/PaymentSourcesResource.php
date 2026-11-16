<?php

namespace Voidhash\Resources;

use Voidhash\Generated\Core\Client;
use Voidhash\Internal\ProjectScope;

/**
 * Reports payments from providers Voidhash does not integrate natively, and
 * asks them to cancel or refund through their provider endpoint. Choose the
 * source by its payment provider id, shown on the source's page in Studio:
 *
 *     $client->paymentSources->source('pp_conf_...')->charge('txn_123', new Charge(...));
 */
final class PaymentSourcesResource
{
    /** @var array<string, PaymentSourceResource> */
    private array $sources = [];

    public function __construct(
        private readonly Client $core,
        private readonly ProjectScope $project,
    ) {
    }

    /** The payment source with this payment provider id (`pp_conf_...`). */
    public function source(string $paymentProviderId): PaymentSourceResource
    {
        return $this->sources[$paymentProviderId] ??= new PaymentSourceResource(
            $this->core,
            $this->project,
            $paymentProviderId,
        );
    }
}
