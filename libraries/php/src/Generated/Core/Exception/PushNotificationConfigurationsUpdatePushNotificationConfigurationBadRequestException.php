<?php

namespace Voidhash\Generated\Core\Exception;

class PushNotificationConfigurationsUpdatePushNotificationConfigurationBadRequestException extends BadRequestException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiPushNotificationConfigurationValidationErrorJsonEncoding
     */
    private $apiPushNotificationConfigurationValidationErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiPushNotificationConfigurationValidationErrorJsonEncoding $apiPushNotificationConfigurationValidationErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/PushNotificationConfigurationValidationError');
        $this->apiPushNotificationConfigurationValidationErrorJsonEncoding = $apiPushNotificationConfigurationValidationErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiPushNotificationConfigurationValidationErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiPushNotificationConfigurationValidationErrorJsonEncoding
    {
        return $this->apiPushNotificationConfigurationValidationErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}