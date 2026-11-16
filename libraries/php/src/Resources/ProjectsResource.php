<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Model\CreateProjectBodyJsonEncoding;
use Voidhash\Generated\Core\Model\ProjectJsonEncoding;
use Voidhash\Internal\PageCollector;

final class ProjectsResource
{
    public function __construct(private readonly Client $core)
    {
    }

    /** Creates a project in the organization; only a person can, so a secret key cannot. */
    public function create(string $organizationId, CreateProjectBodyJsonEncoding $params): ProjectJsonEncoding
    {
        return $this->core->projectsCreate($organizationId, $params) ?? throw ApiException::unexpectedResponse();
    }

    /** @return list<ProjectJsonEncoding> */
    public function list(string $organizationId): array
    {
        return PageCollector::collect(fn (array $query) => $this->core->projectsList($organizationId, $query));
    }
}
