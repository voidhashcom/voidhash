<?php

namespace Voidhash\Generated\Core\Exception;

class BoardsCreateColumnConflictException extends ConflictException
{
    /**
     * @var \Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding
     */
    private $conflictErrorJsonEncoding;
    /**
     * @var \Psr\Http\Message\ResponseInterface
     */
    private $response;
    public function __construct(\Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding $conflictErrorJsonEncoding, \Psr\Http\Message\ResponseInterface $response)
    {
        parent::__construct('`conflict`: the current state forbids it, or it already exists.');
        $this->conflictErrorJsonEncoding = $conflictErrorJsonEncoding;
        $this->response = $response;
    }
    public function getConflictErrorJsonEncoding(): \Voidhash\Generated\Core\Model\ConflictErrorJsonEncoding
    {
        return $this->conflictErrorJsonEncoding;
    }
    public function getResponse(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response;
    }
}