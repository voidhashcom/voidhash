<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Exception\ApiException as GeneratedApiException;
use Voidhash\Generated\Core\Model\CreateOrganizationBodyJsonEncoding;
use Voidhash\Generated\Core\Model\OrganizationJsonEncoding;

final class OrganizationsResource
{
    public function __construct(private readonly Client $core)
    {
    }

    public function create(string $name): ?OrganizationJsonEncoding
    {
        $params = (new CreateOrganizationBodyJsonEncoding())->setName($name);

        try {
            return $this->core->organizationsCreateOrganization($params);
        } catch (GeneratedApiException $e) {
            throw ApiException::fromThrowable($e);
        }
    }
}
