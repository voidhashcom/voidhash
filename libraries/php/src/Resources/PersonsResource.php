<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Model\CreatePersonBodyJsonEncoding;
use Voidhash\Generated\Core\Model\PersonEntitlementJsonEncoding;
use Voidhash\Generated\Core\Model\PersonJsonEncoding;
use Voidhash\Generated\Core\Model\UpdatePersonBodyJsonEncoding;
use Voidhash\Internal\PageCollector;
use Voidhash\Internal\ProjectScope;

final class PersonsResource
{
    public readonly EntitlementsResource $entitlements;

    public function __construct(
        private readonly Client $core,
        private readonly ProjectScope $project,
    ) {
        $this->entitlements = new EntitlementsResource($core, $project);
    }

    /**
     * Creates a person for a distinct id, or writes the given email and name
     * onto the person who already has it.
     */
    public function create(CreatePersonBodyJsonEncoding $params): PersonJsonEncoding
    {
        return $this->core->personsCreate($this->project->id(), $params) ?? throw ApiException::unexpectedResponse();
    }

    /** @return list<PersonJsonEncoding> */
    public function list(): array
    {
        $projectId = $this->project->id();

        return PageCollector::collect(fn (array $query) => $this->core->personsList($projectId, $query));
    }

    /** @throws ApiException with code `person_not_found` for an unknown or erased person */
    public function get(string $personId): PersonJsonEncoding
    {
        return $this->core->personsGet($this->project->id(), $personId) ?? throw ApiException::unexpectedResponse();
    }

    /** The person with this distinct id, or null when Voidhash has never seen it. */
    public function getByDistinctId(string $distinctId): ?PersonJsonEncoding
    {
        $persons = $this->core->personsList($this->project->id(), ['distinctId' => $distinctId])
            ?? throw ApiException::unexpectedResponse();

        return $persons->getData()[0] ?? null;
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
     *   setOnce?: array<string, mixed>,
     *   traits?: array<string, mixed>
     * } $params
     */
    public function setAttributes(array $params): PersonJsonEncoding
    {
        $projectId = $this->project->id();
        $person = $this->getByDistinctId($params['distinctId']);
        if ($person === null) {
            $create = (new CreatePersonBodyJsonEncoding())->setDistinctId($params['distinctId']);
            if (array_key_exists('email', $params)) {
                $create->setEmail($params['email']);
            }
            if (array_key_exists('name', $params)) {
                $create->setName($params['name']);
            }
            $person = $this->core->personsCreate($projectId, $create) ?? throw ApiException::unexpectedResponse();
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

        return $this->core->personsUpdate($projectId, $person->getId(), $update) ?? throw ApiException::unexpectedResponse();
    }

    /**
     * The person's entitlements: one per perk they can use now, including the
     * access of persons merged into them.
     *
     * @return list<PersonEntitlementJsonEncoding>
     *
     * @throws ApiException with code `person_not_found` for an unknown or erased person
     */
    public function getEntitlements(string $personId): array
    {
        $projectId = $this->project->id();

        return PageCollector::collect(
            fn (array $query) => $this->core->personsListEntitlements($projectId, $personId, $query),
        );
    }
}
