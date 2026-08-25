<?php

namespace Voidhash\Generated\Core\Exception;

class PushNotificationConfigurationsUpdatePushNotificationConfigurationNotFoundException extends NotFoundException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPushNotificationConfigurationNotFoundErrorJsonEncoding
     */
    private $apiPushNotificationConfigurationNotFoundErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPushNotificationConfigurationNotFoundErrorJsonEncoding $apiPushNotificationConfigurationNotFoundErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PushNotificationConfigurationNotFoundError');
        $this->apiPushNotificationConfigurationNotFoundErrorJsonEncoding = $apiPushNotificationConfigurationNotFoundErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPushNotificationConfigurationNotFoundErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPushNotificationConfigurationNotFoundErrorJsonEncoding
    {
        return $this->apiPushNotificationConfigurationNotFoundErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}