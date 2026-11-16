<?php

declare(strict_types=1);

namespace Voidhash\Example\Nimbus;

use Psr\Http\Client\ClientExceptionInterface;
use Voidhash\Example\Exception\VoidhashUnavailableException;
use Voidhash\Exception\ApiException;
use Voidhash\VoidhashClient;

/**
 * The only class that talks to Voidhash about entitlements.
 *
 * Two calls make one snapshot: the person, and their entitlements — one per
 * perk they can use now, each carrying the `pro` slug the rest of the app
 * reasons about. {@see EntitlementCache} keeps both off the hot path.
 */
final class EntitlementResolver
{
    public const PRO_PERK_SLUG = 'pro';

    public function __construct(private readonly VoidhashClient $client)
    {
    }

    /**
     * Fetches a person and their grants.
     *
     * @throws VoidhashUnavailableException when Voidhash gave no usable answer
     *         (transport failure or 5xx) — the caller decides what to serve
     * @throws ApiException for answers that mean something, such as a rejected
     *         secret key, which is a deployment bug and must not be swallowed
     */
    public function fetch(string $distinctId): Entitlements
    {
        // A distinct id Voidhash has never seen is a free user: null, not an error.
        $person = $this->call(fn () => $this->client->persons->getByDistinctId($distinctId));

        if ($person === null) {
            return Entitlements::unknownPerson(Freshness::Live);
        }

        $entitlements = $this->call(fn () => $this->client->persons->getEntitlements($person->getId()), allowPersonNotFound: true);
        $grants = [];

        foreach ($entitlements ?? [] as $entitlement) {
            $grants[] = [
                'perkId' => $entitlement->getPerkId(),
                'perkSlug' => $entitlement->getPerkSlug(),
                'source' => $entitlement->getSource(),
                'expiresAt' => $entitlement->getExpiresAt(),
            ];
        }

        return new Entitlements(
            person: [
                'personId' => $person->getId(),
                'distinctId' => $person->getDistinctId(),
                'email' => $person->getEmail(),
                'name' => $person->getName(),
            ],
            grants: $grants,
            freshness: Freshness::Live,
        );
    }

    /**
     * Runs one SDK call and sorts its failures into "Voidhash said no" and
     * "Voidhash said nothing".
     *
     * Two things are worth copying. Branch on the error's code, never on its
     * status alone: a person erased between the two calls answers 404
     * `person_not_found`, which is an answer, while a 404 `project_not_found`
     * is this server's misconfiguration and must surface. And a transport
     * failure surfaces as a PSR-18 {@see ClientExceptionInterface} from the
     * underlying HTTP client, never as an {@see ApiException}: the SDK only
     * wraps responses it received, so DNS failures and connect timeouts come
     * through raw.
     *
     * @template T
     *
     * @param callable(): T $call
     *
     * @return T|null
     */
    private function call(callable $call, bool $allowPersonNotFound = false): mixed
    {
        try {
            return $call();
        } catch (ApiException $exception) {
            if ($allowPersonNotFound && $exception->getErrorCode() === 'person_not_found') {
                return null;
            }
            if ($exception->getStatus() >= 500) {
                throw new VoidhashUnavailableException($exception->getMessage(), 0, $exception);
            }

            throw $exception;
        } catch (ClientExceptionInterface $exception) {
            throw new VoidhashUnavailableException('voidhash transport failure: ' . $exception->getMessage(), 0, $exception);
        }
    }
}
