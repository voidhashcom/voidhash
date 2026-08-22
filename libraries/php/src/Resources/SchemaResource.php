<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Exception\ApiException as GeneratedApiException;
use Voidhash\Generated\Core\Model\ProjectSchemaResponseJsonEncoding;
use Voidhash\Generated\Core\Model\SchemaVersionJsonEncoding;

final class SchemaResource
{
    public function __construct(private readonly Client $core)
    {
    }

    public function get(): ProjectSchemaResponseJsonEncoding
    {
        try {
            return $this->core->schemaGetSchema() ?? throw new ApiException(500);
        } catch (GeneratedApiException $e) {
            throw ApiException::fromThrowable($e);
        }
    }

    public function version(): SchemaVersionJsonEncoding
    {
        try {
            return $this->core->schemaGetSchemaVersion() ?? throw new ApiException(500);
        } catch (GeneratedApiException $e) {
            throw ApiException::fromThrowable($e);
        }
    }
}
