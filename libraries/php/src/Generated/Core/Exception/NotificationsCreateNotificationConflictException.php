<?php

namespace Voidhash\Generated\Core\Exception;

class NotificationsCreateNotificationConflictException extends ConflictException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPushSendNotEnabledErrorJsonEncoding
     */
    private $apiPushSendNotEnabledErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPushSendNotEnabledErrorJsonEncoding $apiPushSendNotEnabledErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PushSendNotEnabledError');
        $this->apiPushSendNotEnabledErrorJsonEncoding = $apiPushSendNotEnabledErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPushSendNotEnabledErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPushSendNotEnabledErrorJsonEncoding
    {
        return $this->apiPushSendNotEnabledErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}