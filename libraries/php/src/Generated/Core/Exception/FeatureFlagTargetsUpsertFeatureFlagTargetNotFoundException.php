<?php

namespace Voidhash\Generated\Core\Exception;

class FeatureFlagTargetsUpsertFeatureFlagTargetNotFoundException extends NotFoundException
{
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(?\Psr\Http\Message\ResponseInterface $response = null)
    {
        parent::__construct('Api/FeatureFlagNotFoundError | Api/FeatureFlagTargetNotFoundError');
        $this->response = $response;
    }
    public function getResponse(): ?\Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}