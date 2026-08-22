<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Exception\ApiException as GeneratedApiException;
use Voidhash\Generated\Core\Model\CreateProjectBodyJsonEncoding;
use Voidhash\Generated\Core\Model\ProjectJsonEncoding;

final class ProjectsResource
{
    public function __construct(private readonly Client $core)
    {
    }

    public function create(CreateProjectBodyJsonEncoding $params): ?ProjectJsonEncoding
    {
        try {
            return $this->core->projectsCreateProject($params);
        } catch (GeneratedApiException $e) {
            throw ApiException::fromThrowable($e);
        }
    }

    /** @return list<ProjectJsonEncoding> */
    public function list(string $organizationId): array
    {
        try {
            return $this->core->projectsListProjects($organizationId) ?? [];
        } catch (GeneratedApiException $e) {
            throw ApiException::fromThrowable($e);
        }
    }
}
