<?php

namespace Voidhash\Generated\Core\Exception;

class SdkRegisterDeviceForbiddenException extends ForbiddenException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding
     */
    private $apiActionForbiddenErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding $apiActionForbiddenErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('Api/ActionForbiddenError');
        $this->apiActionForbiddenErrorJsonEncoding = $apiActionForbiddenErrorJsonEncoding;
        $this->response = $response;
    }
    public function getApiActionForbiddenErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ApiActionForbiddenErrorJsonEncoding
    {
        return $this->apiActionForbiddenErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}