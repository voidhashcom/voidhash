<?php

namespace Voidhash\Generated\Core\Exception;

class FeatureFlagOverridesArchiveFeatureFlagOverrideNotFoundException extends NotFoundException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiFeatureFlagOverrideNotFoundErrorJsonEncoding
     */
    private $apiFeatureFlagOverrideNotFoundErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiFeatureFlagOverrideNotFoundErrorJsonEncoding $apiFeatureFlagOverrideNotFoundErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/FeatureFlagOverrideNotFoundError');
        $this->apiFeatureFlagOverrideNotFoundErrorJsonEncoding = $apiFeatureFlagOverrideNotFoundErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiFeatureFlagOverrideNotFoundErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiFeatureFlagOverrideNotFoundErrorJsonEncoding
    {
        return $this->apiFeatureFlagOverrideNotFoundErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}