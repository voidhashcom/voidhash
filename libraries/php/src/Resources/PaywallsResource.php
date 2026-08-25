<?php

namespace Voidhash\Resources;

use Psr\Http\Message\StreamInterface;
use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Exception\ApiException as GeneratedApiException;
use Voidhash\Generated\Core\Model\CreatePaywallDeployResponseJsonEncoding;
use Voidhash\Generated\Core\Model\FinalizePaywallDeployResponseJsonEncoding;
use Voidhash\Generated\Core\Model\PaywallLocationJsonEncoding;
use Voidhash\Internal\PageCollector;

final class PaywallsResource
{
    public function __construct(private readonly Client $core)
    {
    }

    /** @return list<PaywallLocationJsonEncoding> */
    public function locations(): array
    {
        return $this->wrap(
            fn () => PageCollector::collect(
                fn (array $query) => $this->core->paywallLocationsListPaywallLocations($query),
            ),
        );
    }

    /**
     * Registers a new paywall deploy from a manifest. The manifest is the
     * free-form JSON object produced by the paywall compiler; it is passed
     * through verbatim.
     *
     * @param array<string, mixed> $manifest
     */
    public function createDeploy(array $manifest): CreatePaywallDeployResponseJsonEncoding
    {
        return $this->wrap(fn () => $this->core->paywallDeploysCreateDeploy($manifest)
            ?? throw new ApiException(500));
    }

    /**
     * Uploads one binary blob for a pending deploy. The sha256 must be the
     * lowercase hex digest of the blob contents.
     *
     * The API answers with an empty acknowledgement object, which the spec
     * carries untyped, so the decoded payload is returned as-is.
     *
     * @param string|resource|StreamInterface $blob
     */
    public function uploadBlob(string $deployId, string $sha256, mixed $blob): object
    {
        return $this->wrap(fn () => $this->core->paywallDeploysUploadBlob($deployId, $sha256, $blob)
            ?? throw new ApiException(500));
    }

    /** Completes a pending deploy after all blobs are uploaded. */
    public function finalizeDeploy(string $deployId): FinalizePaywallDeployResponseJsonEncoding
    {
        return $this->wrap(fn () => $this->core->paywallDeploysFinalizeDeploy($deployId)
            ?? throw new ApiException(500));
    }

    /** @template T @param callable(): T $call @return T */
    private function wrap(callable $call): mixed
    {
        try {
            return $call();
        } catch (GeneratedApiException $e) {
            throw ApiException::fromThrowable($e);
        }
    }
}
