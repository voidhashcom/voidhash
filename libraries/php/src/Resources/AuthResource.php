<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Exception\ApiException as GeneratedApiException;
use Voidhash\Generated\Core\Model\ApiV1AuthSessionGetResponse200;

final class AuthResource
{
    public function __construct(private readonly Client $core)
    {
    }

    /** Validates the configured secret key and reports what it can access. */
    public function session(): ApiV1AuthSessionGetResponse200
    {
        try {
            return $this->core->authSession() ?? throw new ApiException(500);
        } catch (GeneratedApiException $e) {
            throw ApiException::fromThrowable($e);
        }
    }
}
