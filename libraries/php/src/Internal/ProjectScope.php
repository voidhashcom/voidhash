<?php

namespace Voidhash\Internal;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;

/**
 * The project a client's management calls are made in: the configured
 * `projectId`, or else the one project the credential can use. That one is
 * read from the session on the first call that needs it, never while the
 * client is built, and kept for the client's lifetime.
 *
 * @internal
 */
final class ProjectScope
{
    public function __construct(
        private readonly Client $core,
        private ?string $projectId,
    ) {
    }

    /**
     * @throws ApiException with code `configuration_error` when the credential
     *         can use no project or several, so `projectId` must be set
     */
    public function id(): string
    {
        if ($this->projectId !== null) {
            return $this->projectId;
        }

        $projects = ($this->core->sessionGet() ?? throw ApiException::unexpectedResponse())->getProjects();
        if (count($projects) !== 1) {
            throw ApiException::configuration(count($projects) === 0
                ? 'voidhash: this credential cannot use any project; set the projectId option'
                : sprintf('voidhash: this credential can use %d projects; set the projectId option to choose one', count($projects)));
        }

        return $this->projectId = $projects[0]->getId();
    }
}
