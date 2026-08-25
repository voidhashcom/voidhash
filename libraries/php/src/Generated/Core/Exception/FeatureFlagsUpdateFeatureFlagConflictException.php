<?php

namespace Voidhash\Generated\Core\Exception;

class FeatureFlagsUpdateFeatureFlagConflictException extends ConflictException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiFeatureFlagKeyAlreadyExistsErrorJsonEncoding
     */
    private $apiFeatureFlagKeyAlreadyExistsErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiFeatureFlagKeyAlreadyExistsErrorJsonEncoding $apiFeatureFlagKeyAlreadyExistsErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/FeatureFlagKeyAlreadyExistsError');
        $this->apiFeatureFlagKeyAlreadyExistsErrorJsonEncoding = $apiFeatureFlagKeyAlreadyExistsErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiFeatureFlagKeyAlreadyExistsErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiFeatureFlagKeyAlreadyExistsErrorJsonEncoding
    {
        return $this->apiFeatureFlagKeyAlreadyExistsErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}