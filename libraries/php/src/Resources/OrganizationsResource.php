<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Model\CreateOrganizationBodyJsonEncoding;
use Voidhash\Generated\Core\Model\OrganizationJsonEncoding;

final class OrganizationsResource
{
    public function __construct(private readonly Client $core)
    {
    }

    /** Creates an organization owned by the signed-in person; a CLI key can, a secret key cannot. */
    public function create(string $name): OrganizationJsonEncoding
    {
        return $this->core->organizationsCreate((new CreateOrganizationBodyJsonEncoding())->setName($name))
            ?? throw ApiException::unexpectedResponse();
    }
}
