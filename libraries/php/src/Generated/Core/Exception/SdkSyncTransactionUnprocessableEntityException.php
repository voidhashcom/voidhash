<?php

namespace Voidhash\Generated\Core\Exception;

class SdkSyncTransactionUnprocessableEntityException extends UnprocessableEntityException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiSdkTransactionRejectedErrorJsonEncoding
     */
    private $apiSdkTransactionRejectedErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiSdkTransactionRejectedErrorJsonEncoding $apiSdkTransactionRejectedErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/SdkTransactionRejectedError');
        $this->apiSdkTransactionRejectedErrorJsonEncoding = $apiSdkTransactionRejectedErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiSdkTransactionRejectedErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiSdkTransactionRejectedErrorJsonEncoding
    {
        return $this->apiSdkTransactionRejectedErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}