<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Exception\ApiException as GeneratedApiException;
use Voidhash\Generated\Core\Model\CreatePersonRequestBodyJsonEncoding;
use Voidhash\Generated\Core\Model\PersonEntitlementsResponseJsonEncoding;
use Voidhash\Generated\Core\Model\PersonJsonEncoding;
use Voidhash\Generated\Core\Model\PersonJsonEncoding1;
use Voidhash\Generated\Core\Model\UpdatePersonBodyJsonEncoding;
use Voidhash\Internal\PageCollector;

final class PersonsResource
{
    public readonly EntitlementsResource $entitlements;

    public function __construct(private readonly Client $core)
    {
        $this->entitlements = new EntitlementsResource($core);
    }

    public function create(CreatePersonRequestBodyJsonEncoding $params): ?PersonJsonEncoding
    {
        return $this->wrap(fn () => $this->core->personsCreatePerson($params));
    }

    /** @return list<PersonJsonEncoding1> */
    public function list(): array
    {
        return $this->wrap(
            fn () => PageCollector::collect(fn (array $query) => $this->core->personsListPersons($query)),
        );
    }

    public function get(string $personId): ?PersonJsonEncoding1
    {
        return $this->wrap(fn () => $this->core->personsGetPersonById($personId));
    }

    public function getByDistinctId(string $distinctId): ?PersonJsonEncoding1
    {
        return $this->wrap(
            fn () => ($this->core->personsListPersons(['distinctId' => $distinctId])?->getData() ?? [])[0] ?? null,
        );
    }

    /**
     * Writes profile fields and traits for the person with the given distinct
     * id, creating the person when the distinct id is new.
     *
     * Traits describe the person and persist across events, so a fact like a
     * subscription plan belongs here rather than repeated on every event's
     * properties.
     *
     * @param array{
     *   distinctId: string,
     *   email?: string|null,
     *   name?: string|null,
     *   projectId?: string,
     *   setOnce?: array<string, mixed>,
     *   traits?: array<string, mixed>
     * } $params
     */
    public function setAttributes(array $params): ?PersonJsonEncoding1
    {
        return $this->wrap(function () use ($params): ?PersonJsonEncoding1 {
            $query = ['distinctId' => $params['distinctId']];
            if (array_key_exists('projectId', $params)) {
                $query['projectId'] = $params['projectId'];
            }
            $person = ($this->core->personsListPersons($query)?->getData() ?? [])[0] ?? null;
            if ($person === null) {
                $create = (new CreatePersonRequestBodyJsonEncoding())->setDistinctId($params['distinctId']);
                if (array_key_exists('email', $params)) {
                    $create->setEmail($params['email']);
                }
                if (array_key_exists('name', $params)) {
                    $create->setName($params['name']);
                }
                if (array_key_exists('projectId', $params)) {
                    $create->setProjectId($params['projectId']);
                }
                $person = $this->core->personsCreatePerson($create) ?? throw new ApiException(500);
            }

            $update = new UpdatePersonBodyJsonEncoding();
            if (array_key_exists('email', $params)) {
                $update->setEmail($params['email']);
            }
            if (array_key_exists('name', $params)) {
                $update->setName($params['name']);
            }
            if (array_key_exists('setOnce', $params)) {
                $update->setSetOnce($params['setOnce']);
            }
            if (array_key_exists('traits', $params)) {
                $update->setTraits($params['traits']);
            }

            return $this->core->personsUpdatePerson($person->getPersonId(), $update);
        });
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
