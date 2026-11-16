<?php

namespace Voidhash\Generated\Core\Exception;

class BoardsDeleteColumnNotFoundException extends NotFoundException
{
    /**
     * @var \Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding
     */
    private $notFoundErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding $notFoundErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('`not_found`: the resource does not exist, or the credential cannot use its project or organization.');
        $this->notFoundErrorJsonEncoding = $notFoundErrorJsonEncoding;
        $this->response = $response;
    }
    public function getNotFoundErrorJsonEncoding(): \Voidhash\Generated\Core\Model\NotFoundErrorJsonEncoding
    {
        return $this->notFoundErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}