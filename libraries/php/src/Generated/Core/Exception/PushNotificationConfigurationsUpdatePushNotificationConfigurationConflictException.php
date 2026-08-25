<?php

namespace Voidhash\Generated\Core\Exception;

class PushNotificationConfigurationsUpdatePushNotificationConfigurationConflictException extends ConflictException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPushNotificationConfigurationKeyUnavailableErrorJsonEncoding
     */
    private $apiPushNotificationConfigurationKeyUnavailableErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPushNotificationConfigurationKeyUnavailableErrorJsonEncoding $apiPushNotificationConfigurationKeyUnavailableErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PushNotificationConfigurationKeyUnavailableError');
        $this->apiPushNotificationConfigurationKeyUnavailableErrorJsonEncoding = $apiPushNotificationConfigurationKeyUnavailableErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPushNotificationConfigurationKeyUnavailableErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPushNotificationConfigurationKeyUnavailableErrorJsonEncoding
    {
        return $this->apiPushNotificationConfigurationKeyUnavailableErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}