<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Model\MeJsonEncoding;

final class UsersResource
{
    public function __construct(private readonly Client $core)
    {
    }

    /**
     * The profile of the person the credential acts for. Only a person's
     * credential, such as a CLI key, has one: a project secret key fails with
     * `permission_denied` (`person_credential_required`).
     */
    public function current(): MeJsonEncoding
    {
        return $this->core->meGet() ?? throw ApiException::unexpectedResponse();
    }
}
