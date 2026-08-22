<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Exception\ApiException as GeneratedApiException;
use Voidhash\Generated\Core\Model\CreatePersonBodyJsonEncoding;
use Voidhash\Generated\Core\Model\PersonEntitlementsResponseJsonEncoding;
use Voidhash\Generated\Core\Model\PersonJsonEncoding;
use Voidhash\Generated\Core\Model\SetPersonAttributesBodyJsonEncoding;
use Voidhash\Generated\Core\Model\SdkEntitlementGrantJsonEncoding;

final class PersonsResource
{
    public readonly EntitlementsResource $entitlements;

    public function __construct(private readonly Client $core)
    {
        $this->entitlements = new EntitlementsResource($core);
    }

    public function create(CreatePersonBodyJsonEncoding $params): ?PersonJsonEncoding
    {
        return $this->wrap(fn () => $this->core->personsCreatePerson($params));
    }

    /** @return list<PersonJsonEncoding> */
    public function list(): array
    {
        return $this->wrap(fn () => $this->core->personsListPersons() ?? []);
    }

    public function get(string $personId): ?PersonJsonEncoding
    {
        return $this->wrap(fn () => $this->core->personsGetPersonById($personId));
    }

    public function getByDistinctId(string $distinctId): ?PersonJsonEncoding
    {
        return $this->wrap(fn () => $this->core->personsGetPersonByDistinctId($distinctId));
    }

    /**
     * Writes profile fields and traits for the person with the given distinct
     * id, creating the person when the distinct id is new.
     *
     * Traits describe the person and persist across events, so a fact like a
     * subscription plan belongs here rather than repeated on every event's
     * properties.
     */
    public function setAttributes(SetPersonAttributesBodyJsonEncoding $params): ?PersonJsonEncoding
    {
        return $this->wrap(fn () => $this->core->personsSetPersonAttributes($params));
    }

    public function getEntitlements(string $personId): PersonEntitlementsResponseJsonEncoding
    {
        return $this->wrap(
            fn () => $this->core->personsGetPersonEntitlements($personId) ?? throw new ApiException(500),
        );
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
