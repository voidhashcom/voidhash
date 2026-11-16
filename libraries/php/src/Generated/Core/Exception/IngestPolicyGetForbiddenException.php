<?php

namespace Voidhash\Generated\Core\Exception;

class IngestPolicyGetForbiddenException extends ForbiddenException
{
    /**
     * @var \Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding
     */
    private $permissionDeniedErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding $permissionDeniedErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('`permission_denied`: the credential cannot do this here.');
        $this->permissionDeniedErrorJsonEncoding = $permissionDeniedErrorJsonEncoding;
        $this->response = $response;
    }
    public function getPermissionDeniedErrorJsonEncoding(): \Voidhash\Generated\Core\Model\PermissionDeniedErrorJsonEncoding
    {
        return $this->permissionDeniedErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}