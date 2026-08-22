<?php

namespace Voidhash\Generated\Core\Exception;

class WebhooksRetryWebhookDeliveryNotFoundException extends NotFoundException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiWebhookDeliveryNotFoundErrorJsonEncoding
     */
    private $apiWebhookDeliveryNotFoundErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiWebhookDeliveryNotFoundErrorJsonEncoding $apiWebhookDeliveryNotFoundErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/WebhookDeliveryNotFoundError');
        $this->apiWebhookDeliveryNotFoundErrorJsonEncoding = $apiWebhookDeliveryNotFoundErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiWebhookDeliveryNotFoundErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiWebhookDeliveryNotFoundErrorJsonEncoding
    {
        return $this->apiWebhookDeliveryNotFoundErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}