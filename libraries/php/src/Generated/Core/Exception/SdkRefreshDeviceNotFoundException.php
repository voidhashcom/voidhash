<?php

namespace Voidhash\Generated\Core\Exception;

class SdkRefreshDeviceNotFoundException extends NotFoundException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPushDeviceNotFoundErrorJsonEncoding
     */
    private $apiPushDeviceNotFoundErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPushDeviceNotFoundErrorJsonEncoding $apiPushDeviceNotFoundErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PushDeviceNotFoundError');
        $this->apiPushDeviceNotFoundErrorJsonEncoding = $apiPushDeviceNotFoundErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPushDeviceNotFoundErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPushDeviceNotFoundErrorJsonEncoding
    {
        return $this->apiPushDeviceNotFoundErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}