<?php

declare(strict_types=1);

namespace Voidhash\Example\Nimbus;

use Psr\Http\Client\ClientExceptionInterface;
use Voidhash\Example\Exception\VoidhashUnavailableException;
use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Exception\ApiException as WireException;
use Voidhash\VoidhashClient;

/**
 * The only class that talks to Voidhash about entitlements.
 *
 * Three calls make one snapshot: the person, their grants, and the perk
 * catalogue that turns a `perkId` on a grant into the `pro` slug the rest of
 * the app reasons about. The perk list is memoised for the lifetime of the
 * request, and {@see EntitlementCache} keeps the whole thing off the hot path.
 */
final class EntitlementResolver
{
    public const PRO_PERK_SLUG = 'pro';

    /** @var array<string, string>|null perk id => slug */
    private ?array $perkSlugsById = null;

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
        $person = $this->call(fn () => $this->client->persons->getByDistinctId($distinctId), allowNotFound: true);

        if ($person === null) {
            return Entitlements::unknownPerson(Freshness::Live);
        }

        $response = $this->call(fn () => $this->client->persons->getEntitlements($person->getPersonId()), allowNotFound: true);
        $slugs = $this->perkSlugsById();
        $grants = [];

        foreach ($response?->getGrants() ?? [] as $grant) {
            $grants[] = [
                'perkId' => $grant->getPerkId(),
                'perkSlug' => $slugs[$grant->getPerkId()] ?? null,
                'status' => $grant->getStatus(),
                'source' => $grant->getSource(),
                'expiresAt' => $grant->getExpiresAt(),
            ];
        }

        return new Entitlements(
            person: [
                'personId' => $person->getPersonId(),
                'distinctId' => $person->getDistinctId(),
                'email' => $person->getEmail(),
                'name' => $person->getName(),
            ],
            grants: $grants,
            freshness: Freshness::Live,
        );
    }

    /** @return array<string, string> */
    private function perkSlugsById(): array
    {
        if ($this->perkSlugsById !== null) {
            return $this->perkSlugsById;
        }

        $slugs = [];

        foreach ($this->call(fn () => $this->client->perks->list()) ?? [] as $perk) {
            $slugs[$perk->getId()] = $perk->getSlug();
        }

        return $this->perkSlugsById = $slugs;
    }

    /**
     * Runs one SDK call and sorts its failures into "Voidhash said no" and
     * "Voidhash said nothing".
     *
     * Three things are worth copying. A 404 is an answer — an unknown distinct
     * id is a free user, so it becomes null rather than an exception. A
     * transport failure surfaces as a PSR-18 {@see ClientExceptionInterface}
     * from the underlying HTTP client and never as an {@see ApiException}: the
     * SDK only wraps responses it received, so DNS failures and connect
     * timeouts come through raw. And a 5xx arrives as a generated
     * `ServerException`, a different branch of the generated hierarchy from the
     * `ClientException` the SDK resources catch, so it too reaches us
     * unwrapped — {@see ApiException::fromThrowable()} is the documented way to
     * normalise one.
     *
     * @template T
     *
     * @param callable(): T $call
     *
     * @return T|null
     */
    private function call(callable $call, bool $allowNotFound = false): mixed
    {
        try {
            return $call();
        } catch (ApiException $exception) {
            return $this->classify($exception, $allowNotFound);
        } catch (WireException $exception) {
            return $this->classify(ApiException::fromThrowable($exception), $allowNotFound);
        } catch (ClientExceptionInterface $exception) {
            throw new VoidhashUnavailableException('voidhash transport failure: ' . $exception->getMessage(), 0, $exception);
        }
    }

    /**
     * @throws VoidhashUnavailableException
     * @throws ApiException
     */
    private function classify(ApiException $exception, bool $allowNotFound): mixed
    {
        if ($allowNotFound && $exception->getStatus() === 404) {
            return null;
        }
        if ($exception->getStatus() >= 500 || $exception->getStatus() === 0) {
            throw new VoidhashUnavailableException($exception->getMessage(), 0, $exception);
        }

        throw $exception;
    }
}
