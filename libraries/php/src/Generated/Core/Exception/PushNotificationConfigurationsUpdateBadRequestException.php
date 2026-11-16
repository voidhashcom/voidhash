<?php

namespace Voidhash\Generated\Core\Exception;

class PushNotificationConfigurationsUpdateBadRequestException extends BadRequestException
{
    /**
     * @var \Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding
     */
    private $invalidRequestErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding $invalidRequestErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('`invalid_request`: the request is malformed or breaks a rule; `param` names the field.');
        $this->invalidRequestErrorJsonEncoding = $invalidRequestErrorJsonEncoding;
        $this->response = $response;
    }
    public function getInvalidRequestErrorJsonEncoding(): \Voidhash\Generated\Core\Model\InvalidRequestErrorJsonEncoding
    {
        return $this->invalidRequestErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}