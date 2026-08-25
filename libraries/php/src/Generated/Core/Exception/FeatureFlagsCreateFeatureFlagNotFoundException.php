<?php

namespace Voidhash\Generated\Core\Exception;

class FeatureFlagsCreateFeatureFlagNotFoundException extends NotFoundException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiFeatureFlagNotFoundErrorJsonEncoding
     */
    private $apiFeatureFlagNotFoundErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiFeatureFlagNotFoundErrorJsonEncoding $apiFeatureFlagNotFoundErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/FeatureFlagNotFoundError');
        $this->apiFeatureFlagNotFoundErrorJsonEncoding = $apiFeatureFlagNotFoundErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiFeatureFlagNotFoundErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiFeatureFlagNotFoundErrorJsonEncoding
    {
        return $this->apiFeatureFlagNotFoundErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}