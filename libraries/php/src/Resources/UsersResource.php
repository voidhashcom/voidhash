<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Exception\ApiException as GeneratedApiException;
use Voidhash\Generated\Core\Model\UserJsonEncoding;

final class UsersResource
{
    public function __construct(private readonly Client $core)
    {
    }

    public function current(): UserJsonEncoding
    {
        try {
            return $this->core->usersGetUser() ?? throw new ApiException(500);
        } catch (GeneratedApiException $e) {
            throw ApiException::fromThrowable($e);
        }
    }
}
