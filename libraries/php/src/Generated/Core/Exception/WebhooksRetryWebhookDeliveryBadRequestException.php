<?php

namespace Voidhash\Generated\Core\Exception;

class WebhooksRetryWebhookDeliveryBadRequestException extends BadRequestException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiWebhookValidationErrorJsonEncoding
     */
    private $apiWebhookValidationErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiWebhookValidationErrorJsonEncoding $apiWebhookValidationErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/WebhookValidationError');
        $this->apiWebhookValidationErrorJsonEncoding = $apiWebhookValidationErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiWebhookValidationErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiWebhookValidationErrorJsonEncoding
    {
        return $this->apiWebhookValidationErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}