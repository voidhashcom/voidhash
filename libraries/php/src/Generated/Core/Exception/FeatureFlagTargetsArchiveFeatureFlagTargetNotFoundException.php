<?php

namespace Voidhash\Generated\Core\Exception;

class FeatureFlagTargetsArchiveFeatureFlagTargetNotFoundException extends NotFoundException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiFeatureFlagTargetNotFoundErrorJsonEncoding
     */
    private $apiFeatureFlagTargetNotFoundErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiFeatureFlagTargetNotFoundErrorJsonEncoding $apiFeatureFlagTargetNotFoundErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/FeatureFlagTargetNotFoundError');
        $this->apiFeatureFlagTargetNotFoundErrorJsonEncoding = $apiFeatureFlagTargetNotFoundErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiFeatureFlagTargetNotFoundErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiFeatureFlagTargetNotFoundErrorJsonEncoding
    {
        return $this->apiFeatureFlagTargetNotFoundErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}