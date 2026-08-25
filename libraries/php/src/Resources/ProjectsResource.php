<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Exception\ApiException as GeneratedApiException;
use Voidhash\Generated\Core\Model\CreateProjectBodyJsonEncoding;
use Voidhash\Generated\Core\Model\ProjectJsonEncoding;
use Voidhash\Generated\Core\Model\ProjectJsonEncoding1;
use Voidhash\Internal\PageCollector;

final class ProjectsResource
{
    public function __construct(private readonly Client $core)
    {
    }

    public function create(CreateProjectBodyJsonEncoding $params): ?ProjectJsonEncoding1
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
            return PageCollector::collect(
                fn (array $query) => $this->core->organizationsListOrganizationProjects($organizationId, $query),
            );
        } catch (GeneratedApiException $e) {
            throw ApiException::fromThrowable($e);
        }
    }
}
