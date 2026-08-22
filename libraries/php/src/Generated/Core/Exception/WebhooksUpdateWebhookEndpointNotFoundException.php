<?php

namespace Voidhash\Generated\Core\Exception;

class WebhooksUpdateWebhookEndpointNotFoundException extends NotFoundException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiWebhookEndpointNotFoundErrorJsonEncoding
     */
    private $apiWebhookEndpointNotFoundErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiWebhookEndpointNotFoundErrorJsonEncoding $apiWebhookEndpointNotFoundErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/WebhookEndpointNotFoundError');
        $this->apiWebhookEndpointNotFoundErrorJsonEncoding = $apiWebhookEndpointNotFoundErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiWebhookEndpointNotFoundErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiWebhookEndpointNotFoundErrorJsonEncoding
    {
        return $this->apiWebhookEndpointNotFoundErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}