<?php

namespace Voidhash\Generated\Core\Exception;

class SdkEvaluateFeatureFlagsTooManyRequestsException extends TooManyRequestsException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiSdkRateLimitedErrorJsonEncoding
     */
    private $apiSdkRateLimitedErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiSdkRateLimitedErrorJsonEncoding $apiSdkRateLimitedErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/SdkRateLimitedError');
        $this->apiSdkRateLimitedErrorJsonEncoding = $apiSdkRateLimitedErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiSdkRateLimitedErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiSdkRateLimitedErrorJsonEncoding
    {
        return $this->apiSdkRateLimitedErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}