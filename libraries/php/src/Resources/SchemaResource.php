<?php

namespace Voidhash\Resources;

use Voidhash\Exception\ApiException;
use Voidhash\Generated\Core\Client;
use Voidhash\Generated\Core\Model\ProjectSchemaResponseJsonEncoding;
use Voidhash\Generated\Core\Model\SchemaVersionJsonEncoding;
use Voidhash\Internal\ProjectScope;

final class SchemaResource
{
    public function __construct(
        private readonly Client $core,
        private readonly ProjectScope $project,
    ) {
    }

    public function get(): ProjectSchemaResponseJsonEncoding
    {
        return $this->core->schemaGet($this->project->id()) ?? throw ApiException::unexpectedResponse();
    }

    public function version(): SchemaVersionJsonEncoding
    {
        return $this->core->schemaGetVersion($this->project->id()) ?? throw ApiException::unexpectedResponse();
    }
}
