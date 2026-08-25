<?php

namespace Voidhash\Generated\Core\Exception;

class NotificationSendsListNotificationSendDeliveriesNotFoundException extends NotFoundException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPushNotificationSendNotFoundErrorJsonEncoding
     */
    private $apiPushNotificationSendNotFoundErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPushNotificationSendNotFoundErrorJsonEncoding $apiPushNotificationSendNotFoundErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PushNotificationSendNotFoundError');
        $this->apiPushNotificationSendNotFoundErrorJsonEncoding = $apiPushNotificationSendNotFoundErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPushNotificationSendNotFoundErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPushNotificationSendNotFoundErrorJsonEncoding
    {
        return $this->apiPushNotificationSendNotFoundErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}