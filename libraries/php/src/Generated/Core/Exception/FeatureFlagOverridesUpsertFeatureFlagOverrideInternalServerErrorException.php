<?php

namespace Voidhash\Generated\Core\Exception;

class FeatureFlagOverridesUpsertFeatureFlagOverrideInternalServerErrorException extends InternalServerErrorException
{
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(?\Psr\Http\Message\ResponseInterface $response = null)
    {
        parent::__construct('Api/FeatureFlagServiceError | Api/AuthServiceError');
        $this->response = $response;
    }
    public function getResponse(): ?\Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}