<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Model\SessionJsonEncoding;

final class AuthResource
{
    public function __construct(private readonly Client $core)
    {
    }

    /**
     * Validates the configured secret key and describes it: its kind, and the
     * organizations and projects it can use.
     */
    public function session(): SessionJsonEncoding
    {
        return $this->core->sessionGet() ?? throw ApiException::unexpectedResponse();
    }
}
